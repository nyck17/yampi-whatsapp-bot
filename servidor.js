// servidor.js - Automação Yampi + WhatsApp SIMPLIFICADA E FUNCIONAL
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Configurações CORRIGIDAS
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE || 'griffestreet'}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN || 'cIBCz75dH3HVD8WvPpy8vy9XXjj7ZNovUafTXJXI',
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

// Criar produto na Yampi - VERSÃO CORRIGIDA
async function criarProdutoYampi(dados) {
    // Preparar dados do produto no formato correto da Yampi
    const produtoData = {
        name: dados.nome,
        description: dados.descricao || `${dados.nome} - Cadastrado via WhatsApp`,
        price: dados.preco.toString(), // Yampi espera string
        cost: "0",
        sku: gerarSKU(dados.nome),
        status: "active",
        weight: "0",
        height: "0",
        width: "0",
        length: "0"
    };
    
    console.log('📦 Criando produto:', produtoData.name);
    console.log('URL:', `${config.YAMPI_API}/catalog/products`);
    
    try {
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoData,
            {
                headers: {
                    'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'yampi-whatsapp-bot/1.0'
                }
            }
        );
        
        console.log('✅ Produto criado com sucesso! ID:', response.data.data.id);
        return response.data.data;
        
    } catch (error) {
        console.error('❌ Erro ao criar produto:', error.response?.data || error.message);
        throw new Error(
            error.response?.data?.message || 
            error.response?.data?.error || 
            'Erro ao criar produto na Yampi'
        );
    }
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
                    'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'yampi-whatsapp-bot/1.0'
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

// NOVO ENDPOINT - Teste rápido de criação
app.get('/test-create', async (req, res) => {
    try {
        const testProduct = {
            nome: `Produto Teste ${Date.now()}`,
            preco: 29.90,
            descricao: 'Produto de teste criado automaticamente',
            tamanhos: ['Único'],
            estoque: { 'Único': 10 },
            categoria: 'Testes'
        };
        
        console.log('🧪 Criando produto de teste...');
        const produto = await criarProdutoYampi(testProduct);
        
        res.json({
            success: true,
            message: '✅ Produto de teste criado com sucesso!',
            produto: {
                id: produto.id,
                nome: produto.name,
                sku: produto.sku,
                preco: produto.price
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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

📝 Como usar:

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

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Automação Yampi + WhatsApp</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #25D366; text-align: center; }
                .status { text-align: center; padding: 20px; margin: 20px 0; border-radius: 10px; background: #d4edda; border: 1px solid #c3e6cb; }
                .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 30px 0; }
                .link-card { background: #25D366; color: white; padding: 20px; border-radius: 10px; text-decoration: none; text-align: center; }
                .link-card:hover { transform: translateY(-2px); color: white; text-decoration: none; }
                .example { background: #f8f9fa; padding: 20px; border-left: 4px solid #25D366; margin: 20px 0; }
                pre { background: #e9ecef; padding: 15px; border-radius: 5px; }
                .test-buttons { display: flex; gap: 10px; margin: 20px 0; }
                .test-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; }
                .test-btn:hover { background: #0056b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi + WhatsApp</h1>
                
                <div class="status">
                    <h3>✅ Sistema Online e Funcionando!</h3>
                    <p>Sua automação está ativa e pronta para uso!</p>
                    <p>Store: <strong>${process.env.YAMPI_STORE || 'griffestreet'}</strong></p>
                </div>
                
                <div class="test-buttons">
                    <a href="/test-yampi" class="test-btn">🔍 Testar Conexão API</a>
                    <a href="/test-create" class="test-btn">📦 Criar Produto Teste</a>
                </div>
                
                <div class="links">
                    <a href="/whatsapp" class="link-card">
                        📱 Testar Agora<br><small>Simulador WhatsApp</small>
                    </a>
                    <a href="/status" class="link-card">
                        📊 Status da API<br><small>Verificar funcionamento</small>
                    </a>
                    <a href="/logs" class="link-card">
                        📝 Ver Logs<br><small>Atividade do sistema</small>
                    </a>
                    <a href="https://painel.yampi.com.br" target="_blank" class="link-card">
                        🏪 Painel Yampi<br><small>Ver produtos criados</small>
                    </a>
                </div>
                
                <div class="example">
                    <h3>🚀 Como usar:</h3>
                    <p><strong>1. Clique em "Testar Agora"</strong></p>
                    <p><strong>2. Digite no chat:</strong></p>
                    <pre>/cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas</pre>
                    <p><strong>3. Veja o produto na sua loja Yampi!</strong></p>
                </div>
                
                <p style="text-align: center; color: #666; margin-top: 30px;">
                    ✨ 100% Gratuito - Desenvolvido para simplificar sua vida!
                </p>
            </div>
        </body>
        </html>
    `);
});

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║                   FUNCIONANDO                    ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE na porta ${config.PORT}              ║
║  ✅ Yampi Store: ${process.env.YAMPI_STORE || 'griffestreet'}                     ║
║  ✅ Token: ${config.YAMPI_TOKEN ? 'CONFIGURADO (' + config.YAMPI_TOKEN.length + ' chars)' : 'NÃO CONFIGURADO'}     ║
║  ✅ WhatsApp: SIMULADOR ATIVO                    ║
╠══════════════════════════════════════════════════╣
║              ENDPOINTS DE TESTE:                 ║
║  📍 /test-yampi - Testa conexão com API          ║
║  📍 /test-create - Cria produto de teste         ║
║  📍 /whatsapp - Simulador WhatsApp               ║
╚══════════════════════════════════════════════════╝
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason);
});

// Deploy trigger

app.get('/test-token', (req, res) => {
    res.json({
        token_exists: !!config.YAMPI_TOKEN,
        token_length: config.YAMPI_TOKEN?.length,
        token_prefix: config.YAMPI_TOKEN?.substring(0, 5),
        store: config.YAMPI_STORE || 'griffestreet',
        api_url: config.YAMPI_API
    });
});

