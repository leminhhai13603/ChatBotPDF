const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { LLMChain, RetrievalQAChain, ConversationalRetrievalQAChain } = require("langchain/chains");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { Document } = require("langchain/document");
const { BufferMemory, ConversationSummaryMemory } = require("langchain/memory");
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");
const { Pool } = require('pg');
const userModel = require("../models/userModel");
require("dotenv").config();

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0.2,
  maxTokens: 4000,
});

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  batchSize: 512, 
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const conversationMemories = {};

const getMemoryForUser = (userId) => {
  if (!conversationMemories[userId]) {
    conversationMemories[userId] = new ConversationSummaryMemory({
      llm: llm,
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "question",
      outputKey: "text",
      maxTokenLimit: 2000,
    });
  }
  return conversationMemories[userId];
};

const createPGVectorStore = async (userId, userRoles = []) => {
  try {
    const isAdmin = await userModel.isUserAdmin(userRoles);
    
    let filter = {};
    if (!isAdmin) {
      const roleIds = await userModel.getUserRoleIds(userId);
      
      if (roleIds.length === 0) {
        console.log("⚠️ User không có quyền truy cập tài liệu nào.");
        return null;
      }
      
      filter = {
        where: {
          metadata: {
            group_id: {
              in: roleIds
            }
          }
        }
      };
    }
    
    const connectionString = process.env.DATABASE_URL;
    
    return new PGVectorStore(embeddings, {
      postgresConnectionOptions: {
        connectionString: connectionString,
      },
      tableName: "pdf_chunks",
      columns: {
        idColumn: "id",
        vectorColumn: "embedding",
        contentColumn: "content",
        metadataColumn: "metadata",
      },
      filter: filter,
      similarity_threshold: 0.1,
      searchKwargs: {
        k: 10,
        fetchK: 30,
        lambda_mult: 0.5,
        score_threshold: 0.7
      }
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo PGVectorStore:", error);
    throw error;
  }
};

const createConversationChain = async (userId) => {
  const memory = getMemoryForUser(userId);
  
  const user = await userModel.getUserById(userId);
  const userRoles = user.roles;
  
  const promptTemplate = `
  Bạn là trợ lý AI thông minh, được tạo ra để hỗ trợ ${user.fullname || 'người dùng'}.
  
  Thông tin người dùng:
  - Tên: ${user.fullname || 'Chưa cập nhật'}
  - Vai trò: ${userRoles.join(', ')}
  
  Lịch sử hội thoại:
  {chat_history}
  
  Câu hỏi hiện tại: {question}
  
  Hãy trả lời câu hỏi một cách đầy đủ và chính xác.
  ${userRoles.includes('admin') ? 'Bạn có thể cung cấp thông tin chi tiết hơn vì người dùng có quyền admin.' : ''}
  Nếu bạn không biết câu trả lời, hãy nói "Tôi không có đủ thông tin để trả lời câu hỏi này".
  `;
  
  const prompt = PromptTemplate.fromTemplate(promptTemplate);
  
  return new LLMChain({
    llm,
    prompt,
    memory,
    verbose: true,
  });
};

const createRetrievalChain = async (userId, query, userRoles) => {
  try {
    const vectorStore = await createPGVectorStore(userId, userRoles);
    if (!vectorStore) {
      throw new Error("Không thể tạo vectorStore cho người dùng này");
    }
    
    const retriever = vectorStore.asRetriever({
      searchType: "similarity_hybrid",
      k: 8,
      searchKwargs: {
        fetchK: 20,
        lambda_mult: 0.5,
        score_threshold: 0.7,
        filterFn: (doc) => {
          const metadata = doc.metadata || {};
          const fileType = metadata.file_type;
          
          if (fileType === 'csv') {
            return doc.content.includes('|') && doc.content.includes('\n');
          }
          return true;
        }
      }
    });
    
    const memory = getMemoryForUser(userId);
    const user = await userModel.getUserById(userId);
    
    const promptTemplate = `
    Bạn là trợ lý AI thông minh, được tạo ra để hỗ trợ ${user.fullname || 'người dùng'} tìm kiếm và trả lời câu hỏi từ tài liệu.
    
    Thông tin người dùng:
    - Tên: ${user.fullname || 'Chưa cập nhật'}
    - Vai trò: ${user.roles.join(', ')}
    
    Lịch sử hội thoại:
    {chat_history}
    
    Câu hỏi hiện tại: {question}
    
    Dưới đây là thông tin từ tài liệu có liên quan:
    {context}
    
    Hướng dẫn trả lời:
    1. Nếu thông tin đến từ bảng CSV:
       - Giữ nguyên cấu trúc bảng khi trả lời
       - Nêu rõ các cột liên quan
       - Trả lời ngắn gọn, đúng trọng tâm
    
    2. Nếu thông tin đến từ PDF:
       - Tổng hợp thông tin từ nhiều đoạn
       - Trích dẫn nguồn khi cần
       - Giữ cấu trúc logic
    
    3. Chung:
       - Trả lời bằng tiếng Việt
       - Ngắn gọn, đầy đủ và chính xác
       - Nếu không đủ thông tin, nói rõ "Tôi không tìm thấy đủ thông tin trong tài liệu"
       - ${user.roles.includes('admin') ? 'Có thể cung cấp thông tin chi tiết hơn.' : 'Giữ câu trả lời phù hợp với vai trò.'}
    `;
    
    const chain = ConversationalRetrievalQAChain.fromLLM(
      llm,
      retriever,
      {
        memory,
        returnSourceDocuments: true,
        questionGeneratorTemplate: `
          Dựa vào lịch sử hội thoại sau: {chat_history}
          và câu hỏi mới: {question}
          
          Hãy tạo ra một câu hỏi độc lập để tìm kiếm thông tin.
          Nếu câu hỏi liên quan đến dữ liệu bảng, hãy tách thành các phần:
          1. Tìm kiếm cột liên quan
          2. Tìm kiếm giá trị cụ thể
          3. Tìm kiếm mối quan hệ giữa các cột
        `,
        qaTemplate: promptTemplate,
        outputKey: "text",
      }
    );
    
    return chain;
  } catch (error) {
    console.error("❌ Lỗi khi tạo retrieval chain:", error);
    throw error;
  }
};

const queryRetrievalChain = async (userId, query, userRoles) => {
  try {
    const chain = await createRetrievalChain(userId, query, userRoles);
    
    const result = await chain.call({
      question: query,
    });

    let formattedResult = result.text;
    
    if (result.sourceDocuments && result.sourceDocuments.length > 0) {
      formattedResult += "\n\n**Nguồn tài liệu:**\n";
      
      const uniqueSources = {};
      
      result.sourceDocuments.forEach((doc) => {
        const pdfName = doc.metadata?.pdf_name || "Không xác định";
        const pdfId = doc.metadata?.pdf_id;
        const fileType = doc.metadata?.file_type;
        
        if (!uniqueSources[pdfId]) {
          uniqueSources[pdfId] = {
            name: pdfName,
            type: fileType,
            count: 1,
            relevance: doc.metadata?.similarity || 0
          };
        } else {
          uniqueSources[pdfId].count++;
        }
      });
      
      const sortedSources = Object.entries(uniqueSources)
        .sort(([,a], [,b]) => b.relevance - a.relevance);
      
      sortedSources.forEach(([pdfId, source], index) => {
        formattedResult += `\n${index + 1}. ${source.name} (${source.type?.toUpperCase() || 'PDF'}) - ${source.count} đoạn liên quan`;
      });
    }
    
    return formattedResult;
  } catch (error) {
    console.error("❌ Lỗi khi truy vấn retrieval chain:", error);
    throw error;
  }
};

const queryConversation = async (userId, query) => {
  try {
    const chain = createConversationChain(userId);
    
    const result = await chain.call({
      question: query,
    });
    
    return result.text;
  } catch (error) {
    console.error("❌ Lỗi khi truy vấn conversation chain:", error);
    throw error;
  }
};

const clearMemoryForUser = (userId) => {
  if (conversationMemories[userId]) {
    delete conversationMemories[userId];
    return true;
  }
  return false;
};

module.exports = {
  createRetrievalChain,
  queryRetrievalChain,
  queryConversation,
  clearMemoryForUser,
  getMemoryForUser,
}; 