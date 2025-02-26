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
require("dotenv").config();

// Tạo instance của ChatOpenAI
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0.2,
  maxTokens: 4000,
});

// Tạo embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  batchSize: 512, // Tăng batch size để xử lý nhanh hơn
});

// Kết nối PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Lưu trữ lịch sử hội thoại theo userId
const conversationMemories = {};

// Hàm tạo hoặc lấy memory cho user
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

// Hàm tạo PGVectorStore từ PostgreSQL
const createPGVectorStore = async (userId, userRoles = []) => {
  try {
    // Kiểm tra quyền admin
    const isAdmin = Array.isArray(userRoles) && userRoles.some(role => role.toLowerCase() === 'admin');
    
    // Tạo filter dựa trên quyền
    let filter = {};
    if (!isAdmin) {
      // Lấy danh sách role_id của user
      const client = await pool.connect();
      try {
        const roleQuery = `SELECT role_id FROM user_roles WHERE user_id = $1`;
        const roleResult = await client.query(roleQuery, [userId]);
        const roleIds = roleResult.rows.map(row => row.role_id);
        
        if (roleIds.length === 0) {
          console.log("⚠️ User không có quyền truy cập tài liệu nào.");
          return null;
        }
        
        // Tạo filter dựa trên role_id
        filter = {
          where: {
            metadata: {
              group_id: {
                in: roleIds
              }
            }
          }
        };
      } finally {
        client.release();
      }
    }
    
    // Tạo connection string cho PG
    const connectionString = process.env.DATABASE_URL;
    
    // Tạo PGVector store với similarity search
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
      similarity_threshold: 0.1, // Giảm ngưỡng tương đồng xuống 0.1
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo PGVectorStore:", error);
    throw error;
  }
};

// Hàm tạo conversation chain
const createConversationChain = (userId) => {
  const memory = getMemoryForUser(userId);
  
  const promptTemplate = `
  Bạn là trợ lý AI thông minh, được tạo ra để hỗ trợ người dùng.
  
  Lịch sử hội thoại:
  {chat_history}
  
  Câu hỏi hiện tại: {question}
  
  Hãy trả lời câu hỏi một cách đầy đủ và chính xác.
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

// Hàm tạo retrieval chain với memory
const createRetrievalChain = async (userId, query, userRoles) => {
  try {
    // Tạo PGVectorStore
    const vectorStore = await createPGVectorStore(userId, userRoles);
    
    // Tạo retriever với k cao hơn
    const retriever = vectorStore.asRetriever({
      searchType: "similarity",
      k: 8, // Tăng từ 5 lên 8
    });
    
    // Lấy memory cho user
    const memory = getMemoryForUser(userId);
    
    // Tạo prompt template
    const promptTemplate = `
    Bạn là trợ lý AI thông minh, được tạo ra để hỗ trợ người dùng tìm kiếm và trả lời câu hỏi từ tài liệu.
    
    Lịch sử hội thoại:
    {chat_history}
    
    Câu hỏi hiện tại: {question}
    
    Dưới đây là thông tin từ tài liệu có liên quan:
    {context}
    
    Dựa vào thông tin từ tài liệu và lịch sử hội thoại, hãy trả lời câu hỏi một cách đầy đủ và chính xác.
    Nếu thông tin từ tài liệu không đủ để trả lời, hãy nói "Tôi không tìm thấy đủ thông tin trong tài liệu để trả lời câu hỏi này".
    Trả lời ngắn gọn, đầy đủ và chính xác.
    Nếu có thể, hãy trích dẫn nguồn tài liệu trong câu trả lời.
    `;
    
    // Tạo chain
    const chain = ConversationalRetrievalQAChain.fromLLM(
      llm,
      retriever,
      {
        memory,
        returnSourceDocuments: true,
        questionGeneratorTemplate: "Dựa vào lịch sử hội thoại sau: {chat_history} và câu hỏi mới: {question}, hãy tạo ra một câu hỏi độc lập để tìm kiếm thông tin.",
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

// Hàm truy vấn retrieval chain
const queryRetrievalChain = async (userId, query, userRoles) => {
  try {
    const chain = await createRetrievalChain(userId, query, userRoles);
    
    const result = await chain.call({
      question: query,
    });
    
    // Format kết quả với nguồn tài liệu
    let formattedResult = result.text;
    
    if (result.sourceDocuments && result.sourceDocuments.length > 0) {
      formattedResult += "\n\n**Nguồn tài liệu:**\n";
      
      // Tạo danh sách nguồn tài liệu không trùng lặp
      const uniqueSources = {};
      
      result.sourceDocuments.forEach((doc, index) => {
        const pdfName = doc.metadata?.pdf_name || "Không xác định";
        const pdfId = doc.metadata?.pdf_id;
        
        if (!uniqueSources[pdfId]) {
          uniqueSources[pdfId] = {
            name: pdfName,
            count: 1
          };
        } else {
          uniqueSources[pdfId].count++;
        }
      });
      
      // Hiển thị nguồn tài liệu
      Object.keys(uniqueSources).forEach((pdfId, index) => {
        const source = uniqueSources[pdfId];
        formattedResult += `\n${index + 1}. ${source.name} (${source.count} đoạn)`;
      });
    }
    
    return formattedResult;
  } catch (error) {
    console.error("❌ Lỗi khi truy vấn retrieval chain:", error);
    throw error;
  }
};

// Hàm truy vấn conversation chain
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

// Hàm xóa lịch sử hội thoại của user
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