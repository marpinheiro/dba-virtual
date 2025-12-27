// Arquivo: teste-modelos.js
require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ ERRO: Não achei a GEMINI_API_KEY no arquivo .env.local');
    console.error('Verifique se a chave está lá e salva.');
    return;
  }

  console.log(
    '🔑 Testando chave iniciando com:',
    apiKey.substring(0, 5) + '...',
  );

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log(
      '📡 Conectando com o Google para listar modelos disponíveis...',
    );
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Tenta listar os modelos (infelizmente a API JS não tem um listModels simples exposto facilmente,
    // então vamos tentar fazer uma chamada simples num modelo antigo para validar a conexão)

    const result = await model.generateContent('Oi');
    console.log("✅ SUCESSO! O modelo 'gemini-1.5-flash' ESTÁ funcionando.");
    console.log('Resposta do teste:', result.response.text());
  } catch (error) {
    console.error("\n❌ FALHA AO ACESSAR 'gemini-1.5-flash'.");
    console.error('Mensagem de erro:', error.message);

    console.log("\n--- TENTATIVA COM 'gemini-pro' (Modelo Clássico) ---");
    try {
      const modelOld = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const resultOld = await modelOld.generateContent('Oi');
      console.log("✅ SUCESSO! O modelo 'gemini-pro' FUNCIONA.");
      console.log(
        "⚠️ SOLUÇÃO: Você deve alterar seu código para usar 'gemini-pro'.",
      );
    } catch (err2) {
      console.error("❌ O 'gemini-pro' também falhou.");
      console.error(
        "🔴 DIAGNÓSTICO FINAL: Sua API Key é inválida ou o projeto no Google Cloud não tem a API 'Generative Language API' ativada.",
      );
    }
  }
}

checkModels();
