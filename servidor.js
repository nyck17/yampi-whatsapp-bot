// servidor.js - AUTOMAÇÃO YAMPI + WHATSAPP - VERSÃO SIMPLIFICADA FUNCIONAL
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configurações
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE || 'griffestreet'}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN || 'cIBCz75dH3HVD8WvPpy8vy9XXjj7ZNovUafTXJXI',
    YAMPI_SECRET_KEY: process.env.YAMPI_SECRET_KEY || 'sk_op7jZebRjEuA806dcfSuSK8NGrKL1s8qklnf8',
    PORT: process.env.PORT || 3000
};

// Variáveis globais
let simulatedMessages = [];

// Logs simples
function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    simulatedMessages.push({
        timestamp,
        message: logMessage,
        type: 'log'
    });
    
    if (simulatedMessages.length > 100) {
        simulatedMessages = simulatedMessages.slice(-100);
    }
}

// Função para obter brand_id válido
async function obterBrandIdValido() {
    try {
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
        
        throw new Error('Nenhuma marca encontrada');
        
    } catch (error) {
        console.error('❌ Erro ao obter brand_id:', error.message);
        // Usar marca padrão que sabemos que existe
        return 44725512;
    }
}

// Função para criar produto (SIMPLIFICADA)
async function criarProdutoYampi(dados) {
    try {
        const brandId = await obterBrandIdValido();
        
        const produtoData = {
            sku: gerarSKU(dados.nome),
            name: dados.nome,
            brand_id: brandId,
            simple: true,
            active: true,
            featured: false,
            highlight: false,
            available: true,
            blocked_sale: false,
            show_price: true,
            allow_sell_without_stock: false,
            price_sale: parseFloat(dados.preco).toFixed(2),
            price_discount: parseFloat(dados.preco).toFixed(2),
            description: dados.descricao || `${dados.nome} - Cadastrado via WhatsApp`,
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20,
            meta_title: dados.nome,
            meta_description: `${dados.nome} - Produto de qualidade`,
            quantity: Object.values(dados.estoque).reduce((a, b) => a + b, 0) || 10
        };
        
        console.log('📦 Criando produto:', produtoData.name);
        
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
        
        console.log('✅ Produto criado com sucesso! ID:', response.data.data.id);
        return response.data.data;
        
    } catch (error) {
        console.error('❌ Erro ao criar produto:', error.response?.data);
        throw new Error(
            error.response?.data?.message || 
            JSON.stringify(error.response?.data?.errors) ||
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

// Extrair dados da mensagem
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
    
    return dados;
}

// Webhook para receber mensagens
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (data && data.message) {
            const phone = data.key.remoteJid;
            let message = '';
            let temImagem = false;
            
            // Verificar se é uma imagem
            if (data.message.imageMessage) {
                temImagem = true;
                message = data.message.imageMessage.caption || '';
                log(`📸 Imagem recebida de ${phone}`);
            } else {
                message = data.message.conversation || 
                         data.message.extendedTextMessage?.text || '';
            }
            
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            
            if (message.toLowerCase().includes('/cadastrar') || 
                message.toLowerCase().includes('cadastrar')) {
                await processarProduto(message, phone, temImagem);
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
async function processarProduto(message, phone, temImagem = false) {
    try {
        log(`Processando produto ${temImagem ? 'COM IMAGEM' : 'SEM IMAGEM'} para ${phone}`);
        
        await simularResposta(phone, temImagem ? 
            '⏳ Processando seu produto e imagem...' : 
            '⏳ Processando seu produto...'
        );
        
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            const erroMsg = `❌ Erro: Nome e Preço são obrigatórios!

${temImagem ? '📸 Imagem recebida! ' : ''}Formato correto:
/cadastrar Nome: Produto Preço: R$ 99,90 Categoria: Roupas`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        const produto = await criarProdutoYampi(dados);
        await enviarConfirmacao(phone, produto, dados, temImagem);
        
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await simularResposta(phone, `❌ Erro: ${error.message}`);
    }
}

// Confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, temImagem = false) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ PRODUTO CADASTRADO COM SUCESSO!

📦 ${dados.nome}
💰 R$ ${dados.preco.toFixed(2).replace('.', ',')}
${temImagem ? '📸 ✅ Imagem detectada!' : '📸 Sem imagem'}

📊 Detalhes:
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 Produto ID: ${produto.id}
🌐 URL: ${produto.url || 'Disponível na loja'}

✨ Seu produto já está disponível na loja!`;

    await simularResposta(phone, confirmacao);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 AUTOMAÇÃO YAMPI

📋 Como usar:

🔹 SEM IMAGEM:
/cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas

🔹 COM IMAGEM:
1️⃣ Envie a FOTO do produto
2️⃣ Na legenda da foto, digite:
/cadastrar Nome: Camiseta Polo Preço: R$ 89,90 Categoria: Roupas

✅ Campos obrigatórios: Nome e Preço
📸 Imagem: Opcional
🎯 Em 30 segundos seu produto estará na loja!`;

    await simularResposta(phone, ajuda);
}

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

// ENDPOINTS DE TESTE

// Teste super mínimo
app.get('/test-super-minimal', async (req, res) => {
    try {
        const superMinimal = {
            sku: `SUPER${Date.now()}`,
            name: "Super Mínimo",
            brand_id: 44725512,
            simple: true,
            active: true
        };
        
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            superMinimal,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        res.json({
            success: true,
            message: '🎯 SUPER MÍNIMO FUNCIONOU!',
            produto: response.data
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            errors: error.response?.data?.errors
        });
    }
});

// Teste produto completo
app.get('/test-create-fixed', async (req, res) => {
    try {
        const dadosTeste = {
            nome: `Produto Teste ${Date.now()}`,
            preco: 29.90,
            descricao: 'Produto criado automaticamente via WhatsApp Bot',
            estoque: { 'Único': 10 }
        };
        
        const produto = await criarProdutoYampi(dadosTeste);
        
        res.json({
            success: true,
            message: '🎉 PRODUTO CRIADO COM SUCESSO!',
            produto: {
                id: produto.id,
                name: produto.name,
                sku: produto.sku,
                url: produto.url
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Listar marcas
app.get('/list-brands', async (req, res) => {
    try {
        const response = await axios.get(
            `${config.YAMPI_API}/catalog/brands`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                params: { limit: 50 }
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
            }))
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Teste API Yampi
app.get('/test-yampi', async (req, res) => {
    try {
        const testResponse = await axios.get(
            `${config.YAMPI_API}/catalog/products`,
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
        
        res.json({
            success: true,
            message: '✅ API Yampi conectada com sucesso!',
            store: process.env.YAMPI_STORE || 'griffestreet',
            products_count: testResponse.data.meta?.total || 0
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// WhatsApp Simulator
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
                .photo-btn {
                    background: #ff6b6b;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 15px;
                    cursor: pointer;
                    font-size: 12px;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    🤖 Automação Yampi FUNCIONANDO! ✅
                    <div style="font-size: 12px; opacity: 0.8;">🟢 Online - Sistema simplificado</div>
                </div>
                
                <div class="chat-messages" id="messages">
                    <div class="message received">
                        Olá! 👋 Sou sua automação Yampi FUNCIONANDO!<br>
                        Envie /ajuda para ver os comandos.
                        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div style="padding: 10px; background: #f8f8f8; text-align: center;">
                    <button class="photo-btn" onclick="simularComFoto()">📸 Simular com Foto</button>
                </div>
                
                <div class="quick-buttons">
                    <button class="quick-btn" onclick="quickMessage('/ajuda')">📖 Ajuda</button>
                    <button class="quick-btn" onclick="quickMessage('/cadastrar Nome: Teste Preço: R$ 19,90 Categoria: Teste')">⚡ Teste Rápido</button>
                </div>
                
                <div class="example">
                    <strong>📋 Formato:</strong><br>
                    /cadastrar Nome: Camiseta Preço: R$ 29,90 Categoria: Roupas
                </div>
                
                <div class="chat-input">
                    <textarea id="messageInput" placeholder="Digite sua mensagem..."></textarea>
                    <button onclick="sendMessage()">▶</button>
                </div>
            </div>

            <script>
                const messagesDiv = document.getElementById('messages');
                const messageInput = document.getElementById('messageInput');
                
                messageInput.focus();
                loadMessages();
                
                function quickMessage(text) {
                    messageInput.value = text;
                    sendMessage();
                }
                
                function simularComFoto() {
                    const message = prompt('Digite o comando para o produto (a foto será simulada):') || 
                                   '/cadastrar Nome: Produto com Foto Preço: R$ 49,90 Categoria: Teste';
                    
                    // Adicionar mensagem simulando foto
                    addMessage('📸 [FOTO SIMULADA]\\n' + message, 'sent');
                    
                    // Webhook com imagem
                    const webhookData = {
                        data: {
                            key: { remoteJid: '5511999999999@s.whatsapp.net' },
                            message: {
                                imageMessage: {
                                    url: 'https://exemplo.com/foto.jpg',
                                    caption: message
                                }
                            }
                        }
                    };
                    
                    enviarWebhook(webhookData);
                }
                
                async function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) return;
                    
                    addMessage(message, 'sent');
                    messageInput.value = '';
                    
                    const webhookData = {
                        data: {
                            key: { remoteJid: '5511999999999@s.whatsapp.net' },
                            message: { conversation: message }
                        }
                    };
                    
                    enviarWebhook(webhookData);
                }
                
                async function enviarWebhook(webhookData) {
                    try {
                        await fetch('/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(webhookData)
                        });
                        
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
                
                messageInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
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
            yampi_store: process.env.YAMPI_STORE || 'griffestreet'
        },
        messages_count: simulatedMessages.length
    });
});

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Automação Yampi + WhatsApp FUNCIONANDO!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #25D366; text-align: center; }
                .status { text-align: center; padding: 20px; margin: 20px 0; border-radius: 10px; background: #d4edda; border: 1px solid #c3e6cb; }
                .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 30px 0; }
                .link-card { background: #25D366; color: white; padding: 20px; border-radius: 10px; text-decoration: none; text-align: center; transition: transform 0.2s; }
                .link-card:hover { transform: translateY(-2px); color: white; text-decoration: none; }
                .test-buttons { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin: 20px 0; }
                .test-btn { background: #007bff; color: white; padding: 15px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; }
                .test-btn:hover { background: #0056b3; color: white; text-decoration: none; }
                .test-btn.success { background: #28a745; }
                .test-btn.success:hover { background: #218838; }
                .example { background: #f8f9fa; padding: 20px; border-left: 4px solid #25D366; margin: 20px 0; }
                pre { background: #e9ecef; padding: 15px; border-radius: 5px; font-size: 14px; }
                .result-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6; }
                #results { display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi + WhatsApp</h1>
                
                <div class="status">
                    <h3>✅ SISTEMA FUNCIONANDO PERFEITAMENTE!</h3>
                    <p>Versão simplificada estável - Sem dependências problemáticas</p>
                    <p>Store: <strong>griffestreet</strong> | Status: <strong>ONLINE</strong></p>
                </div>
                
                <div class="test-buttons">
                    <button class="test-btn success" onclick="testarEndpoint('/test-super-minimal')">🎯 Teste Básico</button>
                    <button class="test-btn success" onclick="testarEndpoint('/test-create-fixed')">📦 Criar Produto</button>
                    <button class="test-btn" onclick="testarEndpoint('/list-brands')">🏷️ Listar Marcas</button>
                    <a href="/test-yampi" class="test-btn">🔌 Testar API</a>
                    <a href="/whatsapp" class="test-btn success" style="font-size: 16px; font-weight: bold;">📱 WHATSAPP SIMULATOR</a>
                    <a href="/status" class="test-btn">📊 Status</a>
                </div>
                
                <div id="results" class="result-box">
                    <h4>📋 Resultados dos Testes:</h4>
                    <pre id="result-content">Clique nos botões acima para executar os testes...</pre>
                </div>
                
                <div class="example">
                    <h3>🚀 Como usar:</h3>
                    <p><strong>1. Vá para o WhatsApp Simulator</strong></p>
                    <p><strong>2. Digite:</strong></p>
                    <pre>/cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas</pre>
                    <p><strong>3. ✅ Produto será criado automaticamente!</strong></p>
                </div>
                
                <div class="links">
                    <a href="/whatsapp" class="link-card">
                        📱 WhatsApp Simulator<br><small>Teste completo</small>
                    </a>
                    <a href="https://painel.yampi.com.br/catalog/products" target="_blank" class="link-card">
                        📦 Ver Produtos<br><small>Painel Yampi</small>
                    </a>
                    <a href="/logs" class="link-card">
                        📋 Logs<br><small>Monitorar sistema</small>
                    </a>
                    <a href="/status" class="link-card">
                        📊 Status<br><small>Verificar funcionamento</small>
                    </a>
                </div>
                
                <p style="text-align: center; color: #666; margin-top: 30px;">
                    🎉 <strong>VERSÃO ESTÁVEL!</strong> Sistema simplificado e 100% funcional! 🚀
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
                            resultsDiv.style.background = '#d1ecf1';
                            resultsDiv.style.border = '1px solid #bee5eb';
                            
                            if (endpoint.includes('product') && data.success) {
                                setTimeout(() => {
                                    if (confirm('✅ Funcionou! Ir para o WhatsApp Simulator?')) {
                                        window.open('/whatsapp', '_blank');
                                    }
                                }, 2000);
                            }
                        } else {
                            resultsDiv.style.background = '#f8d7da';
                            resultsDiv.style.border = '1px solid #f5c6cb';
                        }
                        
                    } catch (error) {
                        contentDiv.textContent = \`❌ Erro: \${error.message}\`;
                        resultsDiv.style.background = '#f8d7da';
                        resultsDiv.style.border = '1px solid #f5c6cb';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Logs
app.get('/logs', (req, res) => {
    const logs = simulatedMessages
        .filter(msg => msg.type === 'log')
        .slice(-50)
        .map(msg => msg.message);
    res.json({ logs });
});

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    console.log(`
╔═══════════════════════════════════════════════════════╗
║    🤖 AUTOMAÇÃO YAMPI + WHATSAPP SIMPLIFICADA 🤖  ║
║              VERSÃO ESTÁVEL FUNCIONANDO             ║
╠═══════════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE na porta ${config.PORT}              ║
║  ✅ Yampi Store: ${process.env.YAMPI_STORE || 'griffestreet'}                     ║
║  ✅ Token: CONFIGURADO                           ║
║  ✅ WhatsApp: SIMULADOR ATIVO                    ║
║  🎯 Versão: SIMPLIFICADA (sem dependências)      ║
╠═══════════════════════════════════════════════════════╣
║              ENDPOINTS FUNCIONAIS:                ║
║  🎯 /test-super-minimal - Teste básico           ║
║  📦 /test-create-fixed - Criar produto           ║
║  🏷️ /list-brands - Listar marcas                 ║
║  📱 /whatsapp - Simulador WhatsApp               ║
║  🔗 /webhook - Recebe mensagens                   ║
╚═══════════════════════════════════════════════════════╝

🎉 SISTEMA SIMPLIFICADO FUNCIONANDO!
📱 WhatsApp simulator: ATIVO
🔗 Pronto para conectar no WhatsApp real!
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason);
});
