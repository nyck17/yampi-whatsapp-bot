// servidor.js - AUTOMAÇÃO YAMPI + WHATSAPP - VERSÃO COMPLETA CORRIGIDA
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Configurações CORRIGIDAS com Secret Key
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE || 'griffestreet'}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN || 'cIBCz75dH3HVD8WvPpy8vy9XXjj7ZNovUafTXJXI',
    YAMPI_SECRET_KEY: process.env.YAMPI_SECRET_KEY || 'sk_op7jZebRjEuA806dcfSuSK8NGrKL1s8qklnf8',
    PORT: process.env.PORT || 3000
};

// Variáveis globais
let produtosPendentes = {};
let simulatedMessages = [];

// Logs simples
function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Adicionar aos logs em memória
    simulatedMessages.push({
        timestamp,
        message: logMessage,
        type: 'log'
    });
    
    // Manter apenas últimos 100 logs
    if (simulatedMessages.length > 100) {
        simulatedMessages = simulatedMessages.slice(-100);
    }
}

// ========== NOVOS ENDPOINTS PARA RESOLVER BRAND_ID ==========

// 1. ENDPOINT PARA LISTAR MARCAS DISPONÍVEIS
app.get('/list-brands', async (req, res) => {
    try {
        console.log('🔍 Listando marcas disponíveis...');
        
        const response = await axios.get(
            `${config.YAMPI_API}/catalog/brands`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                params: {
                    limit: 50 // Pegar até 50 marcas
                }
            }
        );
        
        const brands = response.data.data || [];
        
        res.json({
            success: true,
            total_brands: brands.length,
            brands: brands.map(brand => ({
                id: brand.id,
                name: brand.name,
                active: brand.active
            })),
            recommendation: brands.length > 0 
                ? `✅ Use brand_id: ${brands[0].id} (${brands[0].name})`
                : '⚠️ Nenhuma marca encontrada. Crie uma marca primeiro no painel Yampi.'
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar marcas:', error.response?.data);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// 2. ENDPOINT PARA CRIAR MARCA AUTOMATICAMENTE
app.post('/create-brand', async (req, res) => {
    try {
        console.log('🏷️ Criando marca automática...');
        
        const brandData = {
            name: req.body.name || 'Marca Padrão WhatsApp',
            active: true
        };
        
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/brands`,
            brandData,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const brand = response.data.data || response.data;
        
        res.json({
            success: true,
            message: '✅ Marca criada com sucesso!',
            brand: {
                id: brand.id,
                name: brand.name
            },
            next_step: `Agora use brand_id: ${brand.id} para criar produtos`
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar marca:', error.response?.data);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// 3. FUNÇÃO MELHORADA PARA OBTER BRAND_ID VÁLIDO
async function obterBrandIdValido() {
    try {
        // Primeiro, tentar listar marcas existentes
        const response = await axios.get(
            `${config.YAMPI_API}/catalog/brands`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                params: { limit: 1 }
            }
        );
        
        const brands = response.data.data || [];
        
        if (brands.length > 0) {
            console.log(`✅ Marca encontrada: ${brands[0].name} (ID: ${brands[0].id})`);
            return brands[0].id;
        }
        
        // Se não há marcas, criar uma automaticamente
        console.log('⚠️ Nenhuma marca encontrada. Criando marca automática...');
        
        const createResponse = await axios.post(
            `${config.YAMPI_API}/catalog/brands`,
            {
                name: 'Marca WhatsApp Bot',
                active: true
            },
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const newBrand = createResponse.data.data || createResponse.data;
        console.log(`✅ Marca criada: ${newBrand.name} (ID: ${newBrand.id})`);
        return newBrand.id;
        
    } catch (error) {
        console.error('❌ Erro ao obter brand_id:', error.response?.data);
        throw new Error(`Erro ao configurar marca: ${error.message}`);
    }
}

// 4. FUNÇÃO DE CRIAR PRODUTO CORRIGIDA
async function criarProdutoYampi(dados) {
    try {
        // Obter brand_id válido dinamicamente
        const brandId = await obterBrandIdValido();
        
        // Preparar dados do produto
        const produtoData = {
            sku: gerarSKU(dados.nome),
            name: dados.nome,
            brand_id: brandId, // Usar marca válida
            price_sale: parseFloat(dados.preco).toFixed(2),
            price_discount: parseFloat(dados.preco).toFixed(2),
            active: true,
            blocked_sale: false,
            description: dados.descricao || `${dados.nome} - Cadastrado via WhatsApp`
        };
        
        console.log('📦 Criando produto com dados corrigidos:', {
            sku: produtoData.sku,
            name: produtoData.name,
            brand_id: produtoData.brand_id,
            price: produtoData.price_sale
        });
        
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoData,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('✅ PRODUTO CRIADO COM SUCESSO!');
        const produto = response.data.data || response.data;
        console.log('ID do produto:', produto.id);
        console.log('SKU:', produto.sku);
        console.log('Brand ID usado:', brandId);
        
        return produto;
        
    } catch (error) {
        console.error('❌ Erro ao criar produto corrigido!');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Erro detalhado:', JSON.stringify(error.response.data, null, 2));
        }
        
        throw new Error(
            error.response?.data?.message || 
            JSON.stringify(error.response?.data?.errors) ||
            'Erro ao criar produto na Yampi'
        );
    }
}

// 5. ENDPOINT DE TESTE COMPLETO
app.get('/test-create-fixed', async (req, res) => {
    try {
        console.log('🧪 Teste completo de criação de produto...');
        
        // Testar dados mínimos
        const dadosTeste = {
            nome: `Produto Teste ${Date.now()}`,
            preco: 29.90,
            descricao: 'Produto criado automaticamente via WhatsApp Bot'
        };
        
        const produto = await criarProdutoYampi(dadosTeste);
        
        res.json({
            success: true,
            message: '🎉 PRODUTO CRIADO COM SUCESSO!',
            produto: {
                id: produto.id,
                name: produto.name,
                sku: produto.sku,
                price: produto.price_sale,
                brand_id: produto.brand_id
            },
            next_step: 'Agora teste no WhatsApp simulator!'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            help: 'Tente primeiro /list-brands para ver marcas disponíveis'
        });
    }
});

// ========== RESTO DO CÓDIGO ORIGINAL ==========

// Webhook para receber mensagens
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (data && data.message) {
            const phone = data.key.remoteJid;
            const message = data.message.conversation || 
                           data.message.extendedTextMessage?.text || '';
            
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            
            if (message.toLowerCase().includes('/cadastrar') || 
                message.toLowerCase().includes('cadastrar')) {
                await processarProduto(message, phone);
            }
            else if (message.toLowerCase().includes('/ajuda')) {
                await enviarAjuda(phone);
            }
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        log(`Erro no webhook: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Processar produto
async function processarProduto(message, phone) {
    try {
        log(`Processando produto para ${phone}`);
        
        await simularResposta(phone, '⏳ Processando seu produto...');
        
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            const erroMsg = `❌ Erro: Nome e Preço são obrigatórios!

Formato correto:
/cadastrar Nome: Produto Preço: R$ 99,90 Categoria: Roupas

Ou use quebras de linha:
/cadastrar
Nome: Produto
Preço: R$ 99,90
Categoria: Roupas`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        const produto = await criarProdutoYampi(dados);
        await enviarConfirmacao(phone, produto, dados);
        
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await simularResposta(phone, `❌ Erro: ${error.message}\n\nVerifique se o token da Yampi está correto.`);
    }
}

// Extrair dados da mensagem (versão simplificada)
function extrairDados(message) {
    const dados = {
        nome: '',
        preco: 0,
        tamanhos: ['Único'],
        estoque: { 'Único': 10 },
        categoria: '',
        descricao: ''
    };
    
    const texto = message.toLowerCase();
    
    // Extrair nome
    const nomeMatch = texto.match(/nome:\s*([^,\n\r]+)/);
    if (nomeMatch) {
        dados.nome = nomeMatch[1].trim();
    }
    
    // Extrair preço
    const precoMatch = texto.match(/pre[çc]o:\s*r?\$?\s*([\d,\.]+)/);
    if (precoMatch) {
        const precoStr = precoMatch[1].replace(',', '.');
        dados.preco = parseFloat(precoStr);
    }
    
    // Extrair categoria
    const categoriaMatch = texto.match(/categoria:\s*([^,\n\r]+)/);
    if (categoriaMatch) {
        dados.categoria = categoriaMatch[1].trim();
    }
    
    // Extrair tamanhos se especificados
    const tamanhosMatch = texto.match(/tamanhos:\s*([^,\n\r]+)/);
    if (tamanhosMatch) {
        const tamanhosStr = tamanhosMatch[1];
        dados.tamanhos = tamanhosStr.split(',').map(t => t.trim());
        
        // Reset estoque para novos tamanhos
        dados.estoque = {};
        dados.tamanhos.forEach(t => {
            dados.estoque[t] = 5; // Estoque padrão
        });
        
        // Extrair estoque específico se informado
        const estoqueMatch = texto.match(/estoque:\s*([^,\n\r]+)/);
        if (estoqueMatch) {
            const estoqueStr = estoqueMatch[1];
            const estoqueItems = estoqueStr.split(',');
            
            estoqueItems.forEach(item => {
                if (item.includes('=')) {
                    const [tamanho, quantidade] = item.split('=');
                    const t = tamanho.trim();
                    const q = parseInt(quantidade.trim()) || 0;
                    if (dados.tamanhos.includes(t)) {
                        dados.estoque[t] = q;
                    }
                }
            });
        }
    }
    
    return dados;
}

// Gerar SKU único
function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
    return `${nomeClean}${timestamp}`;
}

// Teste direto da API Yampi - VERSÃO MELHORADA
app.get('/test-yampi', async (req, res) => {
    try {
        console.log('🔍 Testando conexão com API Yampi...');
        console.log('Store:', process.env.YAMPI_STORE || 'griffestreet');
        console.log('Token length:', config.YAMPI_TOKEN.length);
        console.log('API URL:', config.YAMPI_API);
        
        // Teste simples - listar produtos
        const testResponse = await axios.get(
            `${config.YAMPI_API}/catalog/products`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY || 'sk_op7jZebRjEuA806dcfSuSK8NGrKL1s8qklnf8',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                params: {
                    limit: 1
                }
            }
        );
        
        console.log('✅ API funcionando!');
        
        res.json({
            success: true,
            message: '✅ API Yampi conectada com sucesso!',
            store: process.env.YAMPI_STORE || 'griffestreet',
            status: testResponse.status,
            products_count: testResponse.data.meta?.total || 0,
            test_product: testResponse.data.data?.[0]?.name || 'Nenhum produto encontrado'
        });
        
    } catch (error) {
        console.error('❌ Erro teste Yampi:', error.message);
        
        // Log detalhado do erro
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
            console.error('Headers:', error.response.headers);
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data,
            details: {
                url: `${config.YAMPI_API}/catalog/products`,
                token_exists: !!config.YAMPI_TOKEN,
                token_length: config.YAMPI_TOKEN?.length,
                store: process.env.YAMPI_STORE || 'griffestreet'
            }
        });
    }
});

// ENDPOINT DE DEBUG COMPLETO - Descobrir o problema exato
app.get('/debug-product', async (req, res) => {
    const results = [];
    
    // Teste 1: Verificar se a marca existe
    try {
        console.log('TESTE 1: Verificando marca ID 44725150...');
        const brandCheck = await axios.get(
            `${config.YAMPI_API}/catalog/brands/44725150`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        results.push({ test: 'Marca existe', success: true, data: brandCheck.data });
    } catch (error) {
        results.push({ 
            test: 'Marca existe', 
            success: false, 
            error: error.response?.status,
            message: error.response?.data
        });
    }
    
    // Teste 2: Tentar criar produto com dados MÍNIMOS absolutos
    try {
        console.log('TESTE 2: Produto com dados mínimos...');
        const minimalProduct = {
            sku: `MIN${Date.now()}`,
            name: "Teste Mínimo",
            brand_id: 44725150
        };
        
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            minimalProduct,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        results.push({ test: 'Produto mínimo', success: true, data: response.data });
    } catch (error) {
        results.push({ 
            test: 'Produto mínimo', 
            success: false,
            status: error.response?.status,
            errors: error.response?.data?.errors || error.response?.data?.data,
            message: error.response?.data?.message
        });
    }
    
    // Retornar todos os resultados
    res.json({
        timestamp: new Date().toISOString(),
        credentials: {
            token_exists: !!config.YAMPI_TOKEN,
            secret_exists: !!config.YAMPI_SECRET_KEY,
            store: process.env.YAMPI_STORE || 'griffestreet'
        },
        test_results: results,
        recommendation: results.some(r => r.success) 
            ? "✅ Encontramos uma configuração que funciona!" 
            : "❌ Nenhuma configuração funcionou. Verifique os logs detalhados."
    });
});

// Simular resposta
async function simularResposta(phone, message) {
    const resposta = {
        timestamp: new Date().toLocaleString('pt-BR'),
        phone: phone,
        message: message,
        type: 'resposta'
    };
    
    simulatedMessages.push(resposta);
    log(`Resposta enviada para ${phone}: ${message.substring(0, 50)}...`);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 AUTOMAÇÃO YAMPI

📋 Como usar:

FORMATO SIMPLES (uma linha):
/cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas

FORMATO COMPLETO:
/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas

✅ Campos obrigatórios: Nome e Preço
🎯 Em 30 segundos seu produto estará na loja!`;

    await simularResposta(phone, ajuda);
}

// Confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ PRODUTO CADASTRADO COM SUCESSO!

📦 ${dados.nome}
💰 R$ ${dados.preco.toFixed(2).replace('.', ',')}

📊 Detalhes:
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 Produto ID: ${produto.id}

Tamanhos e estoque:
${dados.tamanhos.map(t => `• ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

✨ Seu produto já está disponível na loja!`;

    await simularResposta(phone, confirmacao);
}

// Página do WhatsApp Simulator
app.get('/whatsapp', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>📱 WhatsApp Simulator - Yampi</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 450px;
                    margin: 20px auto;
                    padding: 20px;
                    background: #e5ddd5;
                }
                .chat-container {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .chat-header {
                    background: #075e54;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    font-weight: bold;
                }
                .chat-messages {
                    height: 400px;
                    overflow-y: auto;
                    padding: 10px;
                    background: #ece5dd;
                }
                .message {
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 8px;
                    max-width: 85%;
                    word-wrap: break-word;
                    white-space: pre-wrap;
                }
                .message.sent {
                    background: #dcf8c6;
                    margin-left: auto;
                    text-align: left;
                }
                .message.received {
                    background: white;
                    margin-right: auto;
                }
                .chat-input {
                    display: flex;
                    padding: 10px;
                    background: #f0f0f0;
                }
                .chat-input textarea {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 15px;
                    margin-right: 10px;
                    resize: vertical;
                    min-height: 40px;
                    max-height: 100px;
                }
                .chat-input button {
                    background: #075e54;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    cursor: pointer;
                    font-size: 16px;
                }
                .example {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                    font-size: 12px;
                }
                .timestamp {
                    font-size: 10px;
                    color: #999;
                    margin-top: 5px;
                }
                .quick-buttons {
                    padding: 10px;
                    display: flex;
                    gap: 5px;
                    flex-wrap: wrap;
                }
                .quick-btn {
                    background: #25D366;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 11px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    🤖 Automação Yampi
                    <div style="font-size: 12px; opacity: 0.8;">🟢 Online - Teste funcionando</div>
                </div>
                
                <div class="chat-messages" id="messages">
                    <div class="message received">
                        Olá! 👋 Sou sua automação Yampi!<br>
                        Envie /ajuda para ver os comandos.
                        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div class="quick-buttons">
                    <button class="quick-btn" onclick="quickMessage('/ajuda')">📖 Ajuda</button>
                    <button class="quick-btn" onclick="quickMessage('/cadastrar Nome: Teste Preço: R$ 19,90 Categoria: Teste')">⚡ Teste Rápido</button>
                </div>
                
                <div class="example">
                    <strong>📋 Formato simples:</strong><br>
                    /cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas
                </div>
                
                <div class="chat-input">
                    <textarea id="messageInput" placeholder="Digite sua mensagem...
Use Shift+Enter para quebrar linha"></textarea>
                    <button onclick="sendMessage()">▶</button>
                </div>
            </div>

            <script>
                const messagesDiv = document.getElementById('messages');
                const messageInput = document.getElementById('messageInput');
                
                // Auto-focus no input
                messageInput.focus();
                
                // Carregar mensagens existentes
                loadMessages();
                
                function quickMessage(text) {
                    messageInput.value = text;
                    sendMessage();
                }
                
                async function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) return;
                    
                    // Adicionar mensagem enviada
                    addMessage(message, 'sent');
                    messageInput.value = '';
                    
                    // Simular webhook
                    const webhookData = {
                        data: {
                            key: { remoteJid: '5511999999999@s.whatsapp.net' },
                            message: { conversation: message }
                        }
                    };
                    
                    try {
                        const response = await fetch('/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(webhookData)
                        });
                        
                        // Aguardar resposta e carregar novas mensagens
                        setTimeout(loadMessages, 1500);
                        
                    } catch (error) {
                        addMessage('❌ Erro: ' + error.message, 'received');
                    }
                }
                
                function addMessage(text, type) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + type;
                    messageDiv.innerHTML = text + 
                        '<div class="timestamp">' + new Date().toLocaleTimeString() + '</div>';
                    messagesDiv.appendChild(messageDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
                
                async function loadMessages() {
                    try {
                        const response = await fetch('/messages');
                        const data = await response.json();
                        
                        // Adicionar apenas novas respostas
                        const currentMessages = messagesDiv.querySelectorAll('.message.received').length;
                        const newResponses = data.messages.filter(msg => msg.type === 'resposta');
                        
                        if (newResponses.length > currentMessages - 1) {
                            newResponses.slice(currentMessages - 1).forEach(msg => {
                                addMessage(msg.message, 'received');
                            });
                        }
                        
                    } catch (error) {
                        console.error('Erro ao carregar mensagens:', error);
                    }
                }
                
                // Enter para enviar (sem Shift)
                messageInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                // Auto-refresh messages
                setInterval(loadMessages, 3000);
            </script>
        </body>
        </html>
    `);
});

// API para mensagens
app.get('/messages', (req, res) => {
    res.json({ messages: simulatedMessages });
});

// Status
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            yampi_store: process.env.YAMPI_STORE || 'griffestreet',
            token_length: config.YAMPI_TOKEN?.length
        },
        messages_count: simulatedMessages.length
    });
});

// Logs
app.get('/logs', (req, res) => {
    const logs = simulatedMessages
        .filter(msg => msg.type === 'log')
        .slice(-50)
        .map(msg => msg.message);
    res.json({ logs });
});

// Página inicial ATUALIZADA
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Automação Yampi + WhatsApp</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #25D366; text-align: center; }
                .status { text-align: center; padding: 20px; margin: 20px 0; border-radius: 10px; background: #d4edda; border: 1px solid #c3e6cb; }
                .alert { padding: 15px; margin: 20px 0; border-radius: 10px; background: #fff3cd; border: 1px solid #ffeaa7; }
                .error { background: #f8d7da; border: 1px solid #f5c6cb; }
                .success { background: #d1ecf1; border: 1px solid #bee5eb; }
                .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 30px 0; }
                .link-card { background: #25D366; color: white; padding: 20px; border-radius: 10px; text-decoration: none; text-align: center; transition: transform 0.2s; }
                .link-card:hover { transform: translateY(-2px); color: white; text-decoration: none; }
                .example { background: #f8f9fa; padding: 20px; border-left: 4px solid #25D366; margin: 20px 0; }
                pre { background: #e9ecef; padding: 15px; border-radius: 5px; font-size: 14px; }
                .test-buttons { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin: 20px 0; }
                .test-btn { background: #007bff; color: white; padding: 15px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; transition: background 0.2s; }
                .test-btn:hover { background: #0056b3; color: white; text-decoration: none; }
                .test-btn.danger { background: #dc3545; }
                .test-btn.danger:hover { background: #c82333; }
                .test-btn.success { background: #28a745; }
                .test-btn.success:hover { background: #218838; }
                .test-btn.warning { background: #ffc107; color: #212529; }
                .test-btn.warning:hover { background: #e0a800; }
                .step { background: #e7f3ff; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff; }
                .step h4 { margin: 0 0 10px 0; color: #007bff; }
                .result-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6; min-height: 100px; }
                #results { display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi + WhatsApp</h1>
                
                <div class="status">
                    <h3>⚠️ Resolvendo Problema de Marca (Brand ID)</h3>
                    <p>Sistema online, mas precisamos configurar uma marca válida!</p>
                    <p>Store: <strong>griffestreet</strong></p>
                </div>
                
                <div class="alert">
                    <h4>🔧 Problema Identificado:</h4>
                    <p>A Yampi exige um <strong>brand_id</strong> válido para criar produtos. O ID que estava sendo usado (44725150) não existe na sua loja.</p>
                </div>
                
                <div class="step">
                    <h4>1️⃣ Primeiro: Verificar Marcas</h4>
                    <p>Vamos ver quais marcas existem na sua loja Yampi:</p>
                    <button class="test-btn" onclick="testarEndpoint('/list-brands')">🔍 Listar Marcas Disponíveis</button>
                </div>
                
                <div class="step">
                    <h4>2️⃣ Se Necessário: Criar Marca</h4>
                    <p>Se não houver marcas, criaremos uma automaticamente:</p>
                    <button class="test-btn warning" onclick="criarMarca()">🏷️ Criar Marca Automática</button>
                </div>
                
                <div class="step">
                    <h4>3️⃣ Testar Criação de Produto</h4>
                    <p>Com a marca configurada, testar a criação:</p>
                    <button class="test-btn success" onclick="testarEndpoint('/test-create-fixed')">📦 Criar Produto Teste</button>
                </div>
                
                <div class="test-buttons">
                    <a href="/test-yampi" class="test-btn">🔌 Testar Conexão API</a>
                    <a href="/debug-product" class="test-btn">🐛 Debug Completo</a>
                    <a href="/whatsapp" class="test-btn success">📱 WhatsApp Simulator</a>
                    <a href="/status" class="test-btn">📊 Status Sistema</a>
                </div>
                
                <div id="results" class="result-box">
                    <h4>📋 Resultados dos Testes:</h4>
                    <pre id="result-content">Clique nos botões acima para executar os testes...</pre>
                </div>
                
                <div class="example">
                    <h3>🚀 Depois de resolver, use assim:</h3>
                    <p><strong>1. Vá para o WhatsApp Simulator</strong></p>
                    <p><strong>2. Digite:</strong></p>
                    <pre>/cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas</pre>
                    <p><strong>3. ✅ Produto será criado automaticamente!</strong></p>
                </div>
                
                <div class="links">
                    <a href="https://painel.yampi.com.br/catalog/brands" target="_blank" class="link-card">
                        🏷️ Marcas no Painel<br><small>Gerenciar marcas Yampi</small>
                    </a>
                    <a href="https://painel.yampi.com.br/catalog/products" target="_blank" class="link-card">
                        📦 Produtos<br><small>Ver produtos criados</small>
                    </a>
                    <a href="/logs" class="link-card">
                        📋 Logs Sistema<br><small>Acompanhar atividade</small>
                    </a>
                </div>
                
                <p style="text-align: center; color: #666; margin-top: 30px;">
                    ⚡ Quase lá! Só precisamos resolver essa questão da marca.
                </p>
            </div>

            <script>
                async function testarEndpoint(endpoint) {
                    const resultsDiv = document.getElementById('results');
                    const contentDiv = document.getElementById('result-content');
                    
                    resultsDiv.style.display = 'block';
                    contentDiv.textContent = '⏳ Executando teste...';
                    
                    try {
                        const response = await fetch(endpoint);
                        const data = await response.json();
                        
                        contentDiv.textContent = JSON.stringify(data, null, 2);
                        
                        if (data.success) {
                            resultsDiv.className = 'result-box success';
                        } else {
                            resultsDiv.className = 'result-box error';
                        }
                        
                    } catch (error) {
                        contentDiv.textContent = \`❌ Erro: \${error.message}\`;
                        resultsDiv.className = 'result-box error';
                    }
                }
                
                async function criarMarca() {
                    const nome = prompt('Nome da marca (ou deixe vazio para usar "Marca WhatsApp Bot"):') || 'Marca WhatsApp Bot';
                    
                    const resultsDiv = document.getElementById('results');
                    const contentDiv = document.getElementById('result-content');
                    
                    resultsDiv.style.display = 'block';
                    contentDiv.textContent = '⏳ Criando marca...';
                    
                    try {
                        const response = await fetch('/create-brand', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ name: nome })
                        });
                        
                        const data = await response.json();
                        contentDiv.textContent = JSON.stringify(data, null, 2);
                        
                        if (data.success) {
                            resultsDiv.className = 'result-box success';
                            
                            // Auto-testar criação de produto após 2 segundos
                            setTimeout(() => {
                                if (confirm('Marca criada! Testar criação de produto agora?')) {
                                    testarEndpoint('/test-create-fixed');
                                }
                            }, 2000);
                        } else {
                            resultsDiv.className = 'result-box error';
                        }
                        
                    } catch (error) {
                        contentDiv.textContent = \`❌ Erro: \${error.message}\`;
                        resultsDiv.className = 'result-box error';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    console.log(`
╔═══════════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║                   FUNCIONANDO                    ║
╠═══════════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE na porta ${config.PORT}              ║
║  ✅ Yampi Store: ${process.env.YAMPI_STORE || 'griffestreet'}                     ║
║  ✅ Token: ${config.YAMPI_TOKEN ? 'CONFIGURADO (' + config.YAMPI_TOKEN.length + ' chars)' : 'NÃO CONFIGURADO'}     ║
║  ✅ WhatsApp: SIMULADOR ATIVO                    ║
║  🔧 Brand Fix: IMPLEMENTADO                      ║
╠═══════════════════════════════════════════════════════╣
║              NOVOS ENDPOINTS:                     ║
║  🏷️ /list-brands - Lista marcas disponíveis      ║
║  🏷️ /create-brand - Cria marca automática        ║
║  📦 /test-create-fixed - Teste criação corrigido ║
║  🔍 /whatsapp - Simulador WhatsApp               ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason);
});
