const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { LLMChain, ConversationalRetrievalQAChain } = require("langchain/chains");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { ConversationSummaryMemory } = require("langchain/memory");
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");
const { Pool } = require('pg');
const userModel = require("../models/userModel");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });

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

Dưới đây là thông tin từ NHIỀU tài liệu có liên quan:
{context}

Hướng dẫn trả lời:
1. TỔNG HỢP thông tin từ TẤT CẢ các tài liệu liên quan, KHÔNG chỉ dùng tài liệu đầu tiên.
2. So sánh thông tin từ các tài liệu khác nhau nếu có mâu thuẫn.
3. Trích dẫn rõ nguồn tài liệu trong phần trả lời của bạn.

4. Nếu thông tin đến từ bảng CSV:
   - Giữ nguyên cấu trúc bảng khi trả lời
   - Nêu rõ các cột liên quan
   - Trả lời ngắn gọn, đúng trọng tâm

5. Nếu thông tin đến từ PDF:
   - Tổng hợp thông tin từ nhiều đoạn
   - Trích dẫn nguồn khi cần bằng [Tên tài liệu]
   - Giữ cấu trúc logic

6. Chung:
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
    const vectorStore = await createPGVectorStore(userId, userRoles);
    if (!vectorStore) {
      throw new Error("Không thể tạo vectorStore cho người dùng này");
    }
    
    const retriever = vectorStore.asRetriever({
      searchType: "similarity_hybrid",
      k: 10,
      searchKwargs: {
        fetchK: 25,
        lambda_mult: 0.5,
        score_threshold: 0.65,
      }
    });
    
    const docs = await retriever.getRelevantDocuments(query);
    
    if (!docs || docs.length === 0) {
      return "Tôi không tìm thấy đủ thông tin trong tài liệu để trả lời câu hỏi này.";
    }
    
    let context = "Dưới đây là thông tin từ các tài liệu liên quan:\n\n";
    const uniqueSources = {};
    
    docs.forEach((doc, index) => {
      const pdfName = doc.metadata?.pdf_name || "Không xác định";
      const pdfId = doc.metadata?.pdf_id || index;
      const fileType = doc.metadata?.file_type || "pdf";
      const pageNumber = doc.metadata?.page_number;
      const pageInfo = pageNumber ? ` (Trang ${pageNumber})` : '';
      
      context += `[Tài liệu: ${pdfName}${pageInfo}]\n${doc.pageContent}\n\n`;
      
      const sourceKey = `${pdfId}-${pdfName}`;
      if (!uniqueSources[sourceKey]) {
        uniqueSources[sourceKey] = {
          name: pdfName,
          type: fileType,
          pages: new Set(pageNumber ? [pageNumber] : []),
          count: 1
        };
      } else {
        if (pageNumber) uniqueSources[sourceKey].pages.add(pageNumber);
        uniqueSources[sourceKey].count++;
      }
    });
    
    const geminiPrompt = `
Dựa trên thông tin từ NHIỀU tài liệu dưới đây, hãy trả lời câu hỏi: "${query}"

${context}

Hướng dẫn trả lời:
1. TỔNG HỢP thông tin từ TẤT CẢ các tài liệu liên quan, KHÔNG chỉ dùng tài liệu đầu tiên.
2. So sánh thông tin từ các tài liệu khác nhau nếu có mâu thuẫn.
3. Trích dẫn rõ nguồn tài liệu khi cần thiết bằng cách ghi rõ [Tên tài liệu].
4. Trả lời câu hỏi một cách ngắn gọn, chính xác và đầy đủ dựa trên thông tin được cung cấp.
5. Nếu thông tin trong tài liệu không đủ để trả lời, hãy nói rõ điều đó.`;

    const geminiResponse = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4000,
      }
    });
    
    let formattedResult = "";
    
    if (geminiResponse && geminiResponse.response) {
      formattedResult = geminiResponse.response.text();
    } else {
      formattedResult = "Tôi không thể phân tích thông tin để trả lời câu hỏi này.";
    }
    
    formattedResult += "\n\n**Nguồn tài liệu:**\n";
    
    Object.entries(uniqueSources).forEach(([, source], index) => {
      const pagesInfo = source.pages.size > 0 
        ? ` - Trang: ${Array.from(source.pages).sort((a, b) => a - b).join(', ')}` 
        : '';
      
      formattedResult += `\n${index + 1}. ${source.name} (${source.type?.toUpperCase() || 'PDF'})${pagesInfo} - ${source.count} đoạn liên quan`;
    });
    
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