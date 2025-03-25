const { z } = require('zod');
const pdfModel = require('../../models/pdfModel');
const geminiService = require('../geminiService');
const chatModel = require('../../models/chatModel');
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const axios = require('axios');
const { OpenAI } = require('openai');

// Đăng ký các resources
const registerResources = (server) => {
  // PDF Resource
  server.resource(
    "pdf",
    new ResourceTemplate("pdf://{pdfId}", { list: undefined }),
    async (uri, { pdfId }) => {
      try {
        console.log("🔍 MCP: Đang truy cập PDF với ID:", pdfId);
        const pdf = await pdfModel.getPDFById(pdfId);
        if (!pdf) {
          throw new Error(`Không tìm thấy PDF với ID: ${pdfId}`);
        }
        
        return {
          contents: [{
            uri: uri.href,
            text: pdf.full_text || "Không có nội dung",
            metadata: {
              title: pdf.pdf_name,
              created_at: pdf.uploaded_at,
              author: pdf.uploaded_by_name,
              file_type: pdf.file_type
            }
          }]
        };
      } catch (error) {
        console.error("❌ MCP: Lỗi khi đọc PDF:", error);
        throw error;
      }
    }
  );

  // Danh sách PDF Resource
  server.resource(
    "pdfs",
    "pdfs://list",
    async () => {
      try {
        console.log("🔍 MCP: Đang lấy danh sách PDF");
        const pdfs = await pdfModel.getAllPDFs();
        
        const formattedPdfs = pdfs.map(pdf => ({
          id: pdf.id,
          title: pdf.pdf_name,
          uploaded_at: pdf.uploaded_at,
          author: pdf.uploaded_by_name
        }));
        
        return {
          contents: [{
            uri: "pdfs://list",
            text: JSON.stringify(formattedPdfs, null, 2)
          }]
        };
      } catch (error) {
        console.error("❌ MCP: Lỗi khi lấy danh sách PDF:", error);
        throw error;
      }
    }
  );

  // PDF Chunks Resource
  server.resource(
    "pdf-chunks",
    new ResourceTemplate("pdf-chunks://{pdfId}", { list: undefined }),
    async (uri, { pdfId }) => {
      try {
        console.log("🔍 MCP: Đang lấy chunks của PDF với ID:", pdfId);
        const chunks = await pdfModel.getPDFChunks(pdfId);
        
        return {
          contents: chunks.map((chunk, index) => ({
            uri: `${uri.href}/chunk/${index}`,
            text: chunk.chunk_text,
            metadata: {
              index: index,
              chunk_id: chunk.id
            }
          }))
        };
      } catch (error) {
        console.error("❌ MCP: Lỗi khi lấy PDF chunks:", error);
        throw error;
      }
    }
  );
};

// Đăng ký các tools
const registerTools = (server) => {
  // Tool tìm kiếm PDF
  server.tool(
    "search-pdf",
    {
      query: z.string(),
      pdfId: z.string().optional()
    },
    async ({ query, pdfId }) => {
      try {
        console.log("🔍 MCP: Đang tìm kiếm trong PDF:", { query, pdfId });
        
        let answer;
        if (pdfId) {
          // Tìm kiếm trong một PDF cụ thể
          const pdf = await pdfModel.getPDFById(pdfId);
          if (!pdf) {
            return {
              content: [{ type: "text", text: "Không tìm thấy PDF" }],
              isError: true
            };
          }
          
          // Lấy chunks đã được tạo
          const chunks = await pdfModel.getPDFChunks(pdfId);
          
          // Chuẩn bị dữ liệu cho smartSearch
          const searchData = {
            fileName: pdf.pdf_name,
            title: pdf.pdf_name,
            author: pdf.uploaded_by_name,
            created_at: pdf.uploaded_at,
            fullText: pdf.full_text,
            chunks: chunks.map(chunk => ({
              text: chunk.chunk_text,
              embedding: chunk.embedding
            })),
            queryEmbedding: await geminiService.createEmbedding(query)
          };
          
          // Sử dụng smartSearch để tìm kiếm
          answer = await geminiService.smartSearch(query, searchData);
        } else {
          // Tìm kiếm trong tất cả PDF
          const similarityThreshold = 0.2;
          const maxResults = 10;
          
          const searchResults = await pdfModel.getVectorSearchResultWithRoles(
            await geminiService.createEmbedding(query),
            null,
            ['admin'],
            similarityThreshold,
            maxResults
          );
          
          if (!searchResults || searchResults.length === 0) {
            return {
              content: [{ type: "text", text: "Không tìm thấy thông tin liên quan đến câu hỏi của bạn." }],
              isError: true
            };
          }
          
          console.log(`✅ Tìm thấy ${searchResults.length} tài liệu phù hợp với độ tương đồng > ${similarityThreshold}`);
          
          // Định dạng kết quả
          answer = searchResults.map(result => ({
            pdf_id: result.pdf_id,
            pdf_name: result.pdf_name,
            chunks: result.chunks.map(chunk => ({
              content: chunk.content,
              similarity: chunk.similarity,
              section_title: chunk.section_title
            }))
          }));
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(answer, null, 2) }]
        };
      } catch (error) {
        console.error("❌ MCP: Lỗi khi tìm kiếm:", error);
        return {
          content: [{ type: "text", text: `Lỗi: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Tool tạo embedding
  server.tool(
    "create-embedding",
    {
      text: z.string()
    },
    async ({ text }) => {
      try {
        console.log("🔤 MCP: Đang tạo embedding...");
        const embedding = await geminiService.createEmbedding(text);
        
        return {
          content: [{ 
            type: "text", 
            text: `Embedding được tạo thành công (${embedding.length} chiều)`
          }],
          data: { embedding }
        };
      } catch (error) {
        console.error("❌ MCP: Lỗi khi tạo embedding:", error);
        return {
          content: [{ type: "text", text: `Lỗi: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Tool lưu lịch sử chat
  server.tool(
    "save-chat-history",
    {
      userId: z.string(),
      query: z.string(),
      response: z.string(),
      source: z.string().optional()
    },
    async ({ userId, query, response, source }) => {
      try {
        console.log("💾 MCP: Đang lưu lịch sử chat...");
        const chatId = await chatModel.saveChatHistory(
          userId, 
          query, 
          response, 
          source || "MCP"
        );
        
        return {
          content: [{ 
            type: "text", 
            text: `Lịch sử chat đã được lưu với ID: ${chatId}`
          }],
          data: { chatId }
        };
      } catch (error) {
        console.error("❌ MCP: Lỗi khi lưu lịch sử chat:", error);
        return {
          content: [{ type: "text", text: `Lỗi: ${error.message}` }],
          isError: true
        };
      }
    }
  );
};

// Đăng ký các prompts
const registerPrompts = (server) => {
  // Prompt hỏi về PDF
  server.prompt(
    "question-pdf",
    { 
      question: z.string(),
      pdfId: z.string().optional() 
    },
    ({ question, pdfId }) => {
      if (pdfId) {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Dựa trên tài liệu PDF có ID ${pdfId}, hãy trả lời câu hỏi sau bằng tiếng Việt: ${question}`
            }
          }]
        };
      } else {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Hãy trả lời câu hỏi sau bằng tiếng Việt, dựa trên kiến thức của bạn: ${question}`
            }
          }]
        };
      }
    }
  );

  // Prompt phân tích PDF
  server.prompt(
    "analyze-pdf",
    { 
      pdfId: z.string(),
      analysisType: z.enum(['summary', 'keywords', 'sentiment', 'full'])
    },
    ({ pdfId, analysisType }) => {
      let promptText = `Hãy phân tích tài liệu PDF có ID ${pdfId}`;
      
      switch (analysisType) {
        case 'summary':
          promptText += " và cung cấp một bản tóm tắt ngắn gọn của nội dung chính.";
          break;
        case 'keywords':
          promptText += " và trích xuất các từ khóa quan trọng nhất.";
          break;
        case 'sentiment':
          promptText += " và phân tích giọng điệu, quan điểm của tài liệu.";
          break;
        case 'full':
          promptText += " và cung cấp phân tích đầy đủ bao gồm: tóm tắt, từ khóa, quan điểm, ý chính và đối tượng mục tiêu.";
          break;
      }
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: promptText
          }
        }]
      };
    }
  );

  server.prompt(
    "translate-pdf",
    { 
      pdfId: z.string(),
      targetLanguage: z.string().default('Vietnamese')
    },
    ({ pdfId, targetLanguage }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Hãy dịch nội dung của tài liệu PDF có ID ${pdfId} sang ${targetLanguage}, giữ nguyên định dạng và cấu trúc càng nhiều càng tốt.`
          }
        }]
      };
    }
  );
};

async function searchPDF(query, pdfId = null, userId = null, userRoles = ['admin'], conversationHistory = []) {
    try {
        console.log(`🔍 Tìm kiếm với query: "${query}" ${pdfId ? `trong PDF ID: ${pdfId}` : ''}`);
        
        // 1. Tạo embedding cho câu query
        const queryEmbedding = await createEmbedding(query);
        if (!queryEmbedding) {
            console.error("❌ Không thể tạo embedding cho query");
            return "Không thể xử lý yêu cầu tìm kiếm. Vui lòng thử lại.";
        }
        
        let searchResults;
        
        // 2. Tìm trong PDF cụ thể hoặc tất cả PDF
        if (pdfId) {
            // Kiểm tra PDF tồn tại
            const pdf = await pdfModel.getPDFById(pdfId);
            if (!pdf) {
                return `Không tìm thấy PDF với ID: ${pdfId}`;
            }
            
            // Tìm kiếm trong PDF cụ thể
            const similarChunks = await pdfModel.searchSimilarChunks(
                queryEmbedding,
                null,
                10,
                [pdfId]
            );
            
            if (!similarChunks || similarChunks.length === 0) {
                return `Không tìm thấy thông tin liên quan trong PDF "${pdf.pdf_name}"`;
            }
            
            // Định dạng kết quả
            searchResults = [{
                pdf_id: pdfId,
                pdf_name: pdf.pdf_name,
                chunks: similarChunks.map(chunk => ({
                    content: chunk.content,
                    similarity: chunk.similarity,
                    section_title: chunk.section_title
                }))
            }];
        } else {
            // Tìm kiếm trong tất cả PDF phù hợp với quyền
            const similarityThreshold = 0.2;
            
            searchResults = await pdfModel.getVectorSearchResultWithRoles(
                queryEmbedding,
                userId || 1,
                userRoles
            );
            
            if (!searchResults || searchResults.length === 0) {
                return "Không tìm thấy thông tin liên quan đến câu hỏi của bạn.";
            }
            
            console.log(`✅ Tìm thấy ${searchResults.length} tài liệu phù hợp với độ tương đồng > ${similarityThreshold}`);
        }
        
        // Thêm thông tin chi tiết về kết quả tìm kiếm
        if (searchResults && searchResults.length > 0) {
            console.log(`📊 Chi tiết kết quả tìm kiếm:`);
            searchResults.forEach((result, index) => {
                const avgSimilarity = result.chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / result.chunks.length;
                console.log(`   ${index+1}. ${result.pdf_name}: ${result.chunks.length} chunks, độ tương đồng TB: ${avgSimilarity.toFixed(4)}`);
            });
        }
        
        // 3. Tạo context từ kết quả tìm kiếm
        let context = "";
        let sourceInfo = "### NGUỒN TÀI LIỆU:\n";
        let sourceCount = 1;

        searchResults.forEach(result => {
            sourceInfo += `${sourceCount}. ${result.pdf_name}\n`;
            context += `### TẤT CẢ TÀI LIỆU LIÊN QUAN ${sourceCount}: ${result.pdf_name}\n\n`;
            
            // Sắp xếp các chunk theo độ tương đồng (cao đến thấp)
            const sortedChunks = result.chunks.sort((a, b) => b.similarity - a.similarity);
            
            sortedChunks.forEach(chunk => {
                if (chunk.section_title) {
                    context += `## ${chunk.section_title}\n`;
                }
                context += `${chunk.content}\n\n`;
            });
            
            context += "---\n\n";
            sourceCount++;
        });

        // Thêm metadata về nguồn vào đầu context
        context = sourceInfo + "\n\n" + context;
        
        // Thêm lịch sử hội thoại vào prompt nếu có
        let conversationContext = "";
        if (conversationHistory && conversationHistory.length > 0) {
            conversationContext = "### LỊCH SỬ HỘI THOẠI:\n";
            // Lấy tối đa 3 lượt gần nhất
            const recentHistory = conversationHistory.slice(-6);
            for (let i = 0; i < recentHistory.length; i += 2) {
                if (recentHistory[i]) {
                    conversationContext += `Người dùng: ${recentHistory[i].content}\n`;
                }
                if (recentHistory[i+1]) {
                    conversationContext += `Trợ lý: ${recentHistory[i+1].content.substring(0, 200)}...\n\n`;
                }
            }
            conversationContext += "---\n\n";
        }

        // Thêm vào phần đầu của context
        context = conversationContext + context;
        
        // 4. Tạo prompt cho LLM
        const systemPrompt = `Bạn là trợ lý AI chuyên nghiệp với khả năng phân tích tài liệu chuyên sâu. Bạn luôn cung cấp câu trả lời TOÀN DIỆN, DÀI và ĐẦY ĐỦ CHI TIẾT. Hãy sử dụng tất cả thông tin liên quan từ tài liệu để trả lời. Đừng bỏ sót bất kỳ nội dung quan trọng nào. Khi trích dẫn, chỉ đề cập đến tên đầy đủ của tài liệu nếu biết. KHÔNG sử dụng cách gọi 'Tài liệu 1', 'Tài liệu 2'. Nếu không biết tên tài liệu, hãy bỏ qua việc đề cập tên tài liệu. Trả lời bằng tiếng Việt.`;

        const prompt = `
        ${systemPrompt}

        ### THÔNG TIN CÓ SẴN:
        ${context}

        ### CÂU HỎI CỦA NGƯỜI DÙNG:
        ${query}

        ### HƯỚNG DẪN CHI TIẾT:
        1. Trả lời PHẢI dựa hoàn toàn vào thông tin từ các tài liệu được cung cấp. KHÔNG được tự tạo thông tin.
        2. Nếu tài liệu chứa thông tin mâu thuẫn, hãy đề cập ĐẦY ĐỦ các quan điểm khác nhau.
        3. Trình bày thông tin một cách CÓ CẤU TRÚC và DỄ HIỂU:
            - Bắt đầu bằng câu trả lời tổng quan
            - Tiếp theo là các luận điểm chi tiết kèm ví dụ từ tài liệu
            - Kết thúc bằng tóm tắt ngắn gọn

        4. SỬ DỤNG ĐỊNH DẠNG để làm nổi bật các điểm quan trọng (in đậm, in nghiêng, danh sách).

        ### YÊU CẦU QUAN TRỌNG:
        - Trả lời phải ĐẦY ĐỦ và TOÀN DIỆN, bao gồm mọi khía cạnh liên quan trong tài liệu.
        - Nếu thông tin không đầy đủ, hãy nêu rõ những khía cạnh nào của câu hỏi chưa được trả lời.
        - Nếu cần câu hỏi bổ sung để làm rõ, hãy đề xuất.

        ### ĐỊNH DẠNG CÂU TRẢ LỜI:
        - Tiêu đề: Tóm tắt câu trả lời (1-2 dòng)
        - Câu trả lời chi tiết (chia thành các phần logic)
        - Kết luận: Tóm tắt các điểm chính
        `;
        
        // 5. Gọi LLM để nhận câu trả lời
        const answer = await generateAnswer(prompt);
        
        return answer;
    } catch (error) {
        console.error("❌ Lỗi trong hàm searchPDF:", error);
        return "Đã xảy ra lỗi khi tìm kiếm. Vui lòng thử lại sau.";
    }
}

// Hàm tạo embedding
async function createEmbedding(text) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text
        });
        
        return response.data[0].embedding;
    } catch (error) {
        console.error("❌ Lỗi khi tạo embedding:", error);
        return null;
    }
}

// Hàm sinh câu trả lời từ LLM bằng Gemini 2.0 Flash
async function generateAnswer(prompt) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo-16k",
            messages: [
                { 
                    role: "system", 
                    content: "Bạn là trợ lý AI chuyên nghiệp với khả năng phân tích tài liệu chuyên sâu. Bạn luôn cung cấp câu trả lời TOÀN DIỆN, DÀI và ĐẦY ĐỦ CHI TIẾT. Hãy sử dụng tất cả thông tin liên quan từ tài liệu để trả lời. Đừng bỏ sót bất kỳ nội dung quan trọng nào. Khi trích dẫn, chỉ đề cập đến tên đầy đủ của tài liệu nếu biết. KHÔNG sử dụng cách gọi 'Tài liệu 1', 'Tài liệu 2'. Nếu không biết tên tài liệu, hãy bỏ qua việc đề cập tên tài liệu. Trả lời bằng tiếng Việt."
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 8000,
            top_p: 0.95,
            frequency_penalty: 0.0,
            presence_penalty: 0.0
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error("❌ Lỗi khi tạo câu trả lời:", error);
        return "Đã xảy ra lỗi khi xử lý câu trả lời. Vui lòng thử lại sau.";
    }
}

module.exports = {
  registerResources,
  registerTools,
  registerPrompts,
  searchPDF,
  createEmbedding
}; 