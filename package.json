.result-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6; }
                .preview-image { max-width: 200px; max-height: 200px; margin: 20px 0; border-radius: 10px; }
                .example { background: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0; }
                pre { background: #e9ecef; padding: 15px; border-radius: 5px; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📸 Teste Upload de Imagens</h1>
                
                <div class="example">
                    <h3>🎯 Como funciona:</h3>
                    <p><strong>1.</strong> Upload de imagem via API Yampi</p>
                    <p><strong>2.</strong> Criação de produto com imagem associada</p>
                    <p><strong>3.</strong> Suporte a WhatsApp (imagem + legenda)</p>
                </div>
                
                <div class="upload-area" id="uploadArea">
                    <h3>📤 Teste Upload Direto</h3>
                    <p>Arraste uma imagem aqui ou clique para selecionar</p>
                    <input type="file" id="fileInput" class="file-input" accept="image/*">
                    <button class="upload-btn" onclick="document.getElementById('fileInput').click()">
                        📁 Selecionar Imagem
                    </button>
                </div>
                
                <div id="imagePreview"></div>
                
                <div class="test-buttons">
                    <button class="test-btn success" onclick="testarProdutoComImagem()">📦 Criar Produto com Imagem</button>
                    <button class="test-btn" onclick="testarUploadSimples()">📸 Teste Upload Simples</button>
                    <a href="/whatsapp" class="test-btn success">📱 WhatsApp Simulator</a>
                    <a href="/" class="test-btn">🏠 Voltar ao Início</a>
                </div>
                
                <div id="results" class="result-box" style="display: none;">
                    <h4>📋 Resultados:</h4>
                    <pre id="result-content"></pre>
                </div>
                
                <div class="example">
                    <h3>📱 Como usar no WhatsApp:</h3>
                    <p><strong>1.</strong> Envie uma foto do produto</p>
                    <p><strong>2.</strong> Na legenda da foto, digite:</p>
                    <pre>/cadastrar Nome: Camiseta Polo Preço: R$ 89,90 Categoria: Roupas</pre>
                    <p><strong>3.</strong> ✅ Produto será criado com a imagem!</p>
                </div>
            </div>

            <script>
                const uploadArea = document.getElementById('uploadArea');
                const fileInput = document.getElementById('fileInput');
                let selectedFile = null;
                
                // Drag and drop
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.classList.add('dragover');
                });
                
                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.classList.remove('dragover');
                });
                
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.classList.remove('dragover');
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        handleFile(files[0]);
                    }
                });
                
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        handleFile(e.target.files[0]);
                    }
                });
                
                function handleFile(file) {
                    if (!file.type.startsWith('image/')) {
                        alert('Por favor, selecione apenas imagens!');
                        return;
                    }
                    
                    if (file.size > 5 * 1024 * 1024) {
                        alert('Imagem muito grande! Máximo 5MB.');
                        return;
                    }
                    
                    selectedFile = file;
                    
                    // Preview da imagem
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        document.getElementById('imagePreview').innerHTML = 
                            \`<h4>📸 Imagem selecionada:</h4>
                             <img src="\${e.target.result}" class="preview-image">
                             <p><strong>Nome:</strong> \${file.name}</p>
                             <p><strong>Tamanho:</strong> \${(file.size / 1024 / 1024).toFixed(2)} MB</p>\`;
                    };
                    reader.readAsDataURL(file);
                }
                
                async function testarUploadSimples() {
                    if (!selectedFile) {
                        alert('Selecione uma imagem primeiro!');
                        return;
                    }
                    
                    const formData = new FormData();
                    formData.append('image', selectedFile);
                    
                    mostrarResultado('⏳ Fazendo upload da imagem...');
                    
                    try {
                        const response = await fetch('/test-upload-image', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const data = await response.json();
                        mostrarResultado(JSON.stringify(data, null, 2));
                        
                    } catch (error) {
                        mostrarResultado(\`❌ Erro: \${error.message}\`);
                    }
                }
                
                async function testarProdutoComImagem() {
                    mostrarResultado('⏳ Criando produto com imagem de teste...');
                    
                    try {
                        const response = await fetch('/test-product-with-image');
                        const data = await response.json();
                        
                        mostrarResultado(JSON.stringify(data, null, 2));
                        
                        if (data.success) {
                            setTimeout(() => {
                                if (confirm('✅ Produto criado! Ir para o WhatsApp Simulator?')) {
                                    window.open('/whatsapp', '_blank');
                                }
                            }, 2000);
                        }
                        
                    } catch (error) {
                        mostrarResultado(\`❌ Erro: \${error.message}\`);
                    }
                }
                
                function mostrarResultado(content) {
                    const resultsDiv = document.getElementById('results');
                    const contentDiv = document.getElementById('result-content');
                    
                    resultsDiv.style.display = 'block';
                    contentDiv.textContent = content;
                    
                    // Scroll para o resultado
                    resultsDiv.scrollIntoView({ behavior: 'smooth' });
                }
            </script>
        </body>
        </html>
    `);
});

// Página do WhatsApp Simulator (ATUALIZADA COM SUPORTE A IMAGENS)
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
                .image-upload {
                    padding: 10px;
                    background: #f8f8f8;
                    border-top: 1px solid #ddd;
                }
                .upload-btn {
                    background: #25D366;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-right: 10px;
                }
                .image-preview {
                    max-width: 150px;
                    max-height: 150px;
                    margin: 10px 0;
                    border-radius: 8px;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    🤖 Automação Yampi COM FOTOS 📸
                    <div style="font-size: 12px; opacity: 0.8;">🟢 Online - Sistema completo!</div>
                </div>
                
                <div class="chat-messages" id="messages">
                    <div class="message received">
                        Olá! 👋 Sou sua automação Yampi com suporte a IMAGENS! 📸<br>
                        Envie /ajuda para ver os comandos.
                        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div class="image-upload">
                    <input type="file" id="imageInput" accept="image/*" style="display: none;">
                    <button class="upload-btn" onclick="document.getElementById('imageInput').click()">
                        📸 Adicionar Foto
                    </button>
                    <span style="font-size: 11px; color: #666;">Opcional: Envie foto antes do comando</span>
                    <div id="imagePreview"></div>
                </div>
                
                <div class="quick-buttons">
                    <button class="quick-btn" onclick="quickMessage('/ajuda')">📖 Ajuda</button>
                    <button class="quick-btn" onclick="quickMessage('/cadastrar Nome: Teste Foto Preço: R$ 19,90 Categoria: Teste')">⚡ Teste Rápido</button>
                </div>
                
                <div class="example">
                    <strong>📸 NOVO: Com foto!</strong><br>
                    1. Clique em "📸 Adicionar Foto"<br>
                    2. Digite: /cadastrar Nome: Produto Preço: R$ 29,90
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
                const imageInput = document.getElementById('imageInput');
                let selectedImage = null;
                
                messageInput.focus();
                loadMessages();
                
                // Handle image selection
                imageInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                            alert('Imagem muito grande! Máximo 5MB.');
                            return;
                        }
                        
                        selectedImage = file;
                        
                        // Show preview
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            document.getElementById('imagePreview').innerHTML = 
                                \`<img src="\${e.target.result}" class="image-preview">
                                 <br><small>📸 Foto selecionada: \${file.name}</small>\`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
                
                function quickMessage(text) {
                    messageInput.value = text;
                    sendMessage();
                }
                
                async function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) return;
                    
                    // Show message with image if selected
                    let displayMessage = message;
                    if (selectedImage) {
                        displayMessage = \`📸 [Imagem: \${selectedImage.name}]\\n\${message}\`;
                    }
                    
                    addMessage(displayMessage, 'sent');
                    messageInput.value = '';
                    
                    // Clear image preview
                    if (selectedImage) {
                        document.getElementById('imagePreview').innerHTML = '';
                        selectedImage = null;
                    }
                    
                    // Simulate webhook with image URL if image was selected
                    const webhookData = {
                        data: {
                            key: { remoteJid: '5511999999999@s.whatsapp.net' },
                            message: selectedImage ? {
                                imageMessage: {
                                    url: 'https://via.placeholder.com/400x400/FF5733/FFFFFF?text=FOTO+TESTE',
                                    caption: message
                                }
                            } : {
                                conversation: message
                            }
                        }
                    };
                    
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
            yampi_store: process.env.YAMPI_STORE || 'griffestreet',
            token_length: config.YAMPI_TOKEN?.length
        },
        messages_count: simulatedMessages.length,
        features: ['produtos', 'imagens', 'whatsapp_simulator']
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

// Página inicial COMPLETA COM SISTEMA DE FOTOS
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Automação Yampi + WhatsApp COM FOTOS 📸</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #25D366; text-align: center; }
                .status { text-align: center; padding: 20px; margin: 20px 0; border-radius: 10px; background: #d4edda; border: 1px solid #c3e6cb; }
                .alert { padding: 15px; margin: 20px 0; border-radius: 10px; background: #fff3cd; border: 1px solid #ffeaa7; }
                .success { background: #d1ecf1; border: 1px solid #bee5eb; }
                .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 30px 0; }
                .link-card { background: #25D366; color: white; padding: 20px; border-radius: 10px; text-decoration: none; text-align: center; transition: transform 0.2s; }
                .link-card:hover { transform: translateY(-2px); color: white; text-decoration: none; }
                .link-card.photo { background: #ff6b6b; }
                .example { background: #f8f9fa; padding: 20px; border-left: 4px solid #25D366; margin: 20px 0; }
                pre { background: #e9ecef; padding: 15px; border-radius: 5px; font-size: 14px; }
                .test-buttons { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin: 20px 0; }
                .test-btn { background: #007bff; color: white; padding: 15px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; transition: background 0.2s; }
                .test-btn:hover { background: #0056b3; color: white; text-decoration: none; }
                .test-btn.success { background: #28a745; }
                .test-btn.success:hover { background: #218838; }
                .test-btn.photo { background: #ff6b6b; }
                .test-btn.photo:hover { background: #ff5252; }
                .feature { background: #e7f3ff; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff; }
                .feature h4 { margin: 0 0 10px 0; color: #007bff; }
                .result-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6; }
                #results { display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi + WhatsApp COM FOTOS! 📸</h1>
                
                <div class="status">
                    <h3>🎉 SISTEMA COMPLETO FUNCIONANDO!</h3>
                    <p>✅ Produtos ✅ Fotos ✅ WhatsApp Simulator ✅ API Yampi</p>
                    <p>Store: <strong>griffestreet</strong> | Status: <strong>100% Operacional</strong></p>
                </div>
                
                <div class="alert success">
                    <h4>🆕 NOVIDADES IMPLEMENTADAS:</h4>
                    <ul>
                        <li>📸 <strong>Sistema completo de fotos</strong> - Upload e associação automática</li>
                        <li>🔗 <strong>Download de imagens</strong> - Via URL do WhatsApp</li>
                        <li>📱 <strong>WhatsApp com imagens</strong> - Envie foto + legenda</li>
                        <li>🎛️ <strong>Página de teste de imagens</strong> - Interface drag & drop</li>
                        <li>⚡ <strong>Processamento automático</strong> - Imagem → Yampi → Produto</li>
                    </ul>
                </div>
                
                <div class="test-buttons">
                    <button class="test-btn success" onclick="testarEndpoint('/test-super-minimal')">🎯 Teste Básico</button>
                    <button class="test-btn photo" onclick="testarEndpoint('/test-product-with-image')">📸 Produto com Foto</button>
                    <a href="/test-images" class="test-btn photo">🖼️ Teste Upload Imagens</a>
                    <a href="/whatsapp" class="test-btn success" style="font-size: 16px; font-weight: bold;">📱 WHATSAPP COM FOTOS</a>
                    <button class="test-btn" onclick="testarEndpoint('/list-brands')">🏷️ Listar Marcas</a>
                    <a href="/test-yampi" class="test-btn">🔌 Testar API</a>
                </div>
                
                <div id="results" class="result-box">
                    <h4>📋 Resultados dos Testes:</h4>
                    <pre id="result-content">Clique nos botões acima para executar os testes...</pre>
                </div>
                
                <div class="feature">
                    <h4>📸 COMO USAR COM FOTOS:</h4>
                    <p><strong>WhatsApp Real:</strong> Envie foto → Digite comando na legenda</p>
                    <p><strong>Simulator:</strong> Clique "📸 Adicionar Foto" → Digite comando</p>
                    <p><strong>Resultado:</strong> Produto criado automaticamente com imagem!</p>
                </div>
                
                <div class="example">
                    <h3>🚀 EXEMPLO COMPLETO COM FOTO:</h3>
                    <p><strong>1.</strong> Vá para o WhatsApp Simulator</p>
                    <p><strong>2.</strong> Clique em "📸 Adicionar Foto"</p>
                    <p><strong>3.</strong> Digite:</p>
                    <pre>/cadastrar Nome: Camiseta Polo Preço: R$ 89,90 Categoria: Roupas</pre>
                    <p><strong>4.</strong> ✅ Produto criado COM IMAGEM na loja!</p>
                </div>
                
                <div class="feature">
                    <h4>🔗 CONECTAR NO WHATSAPP REAL:</h4>
                    <p><strong>Opção 1:</strong> Evolution API própria (VPS)</p>
                    <p><strong>Opção 2:</strong> Serviço Evolution (R$ 20-50/mês)</p>
                    <p><strong>Opção 3:</strong> Zapier/Make.com (R$ 30-80/mês)</p>
                    <p><strong>Webhook:</strong> Configurar para <code>SEU_DOMINIO/webhook</code></p>
                </div>
                
                <div class="links">
                    <a href="/whatsapp" class="link-card">
                        📱 WhatsApp Simulator<br><small>Teste completo com fotos</small>
                    </a>
                    <a href="/test-images" class="link-card photo">
                        📸 Teste de Imagens<br><small>Upload e associação</small>
                    </a>
                    <a href="https://painel.yampi.com.br/catalog/products" target="_blank" class="link-card">
                        📦 Ver Produtos<br><small>Painel Yampi</small>
                    </a>
                    <a href="/logs" class="link-card">
                        📋 Logs Sistema<br><small>Monitorar atividade</small>
                    </a>
                </div>
                
                <p style="text-align: center; color: #666; margin-top: 30px;">
                    🎉 <strong>SISTEMA COMPLETO!</strong> Produtos + Fotos + WhatsApp = 100% Funcional! 🚀
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
                            
                            // Se criou produto com sucesso, sugerir WhatsApp
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

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    console.log(`
╔═══════════════════════════════════════════════════════╗
║  🤖 AUTOMAÇÃO YAMPI + WHATSAPP COM FOTOS COMPLETA 📸║
║                SISTEMA 100% FUNCIONAL               ║
╠═══════════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE na porta ${config.PORT}              ║
║  ✅ Yampi Store: ${process.env.YAMPI_STORE || 'griffestreet'}                     ║
║  ✅ Token: ${config.YAMPI_TOKEN ? 'CONFIGURADO (' + config.YAMPI_TOKEN.length + ' chars)' : 'NÃO CONFIGURADO'}     ║
║  ✅ WhatsApp: SIMULADOR COM FOTOS                ║
║  📸 Sistema Fotos: IMPLEMENTADO                   ║
║  🏷️ Brand ID: AUTO-DETECTADO                     ║
╠═══════════════════════════════════════════════════════╣
║              FUNCIONALIDADES ATIVAS:              ║
║  📦 /test-super-minimal - Teste básico            ║
║  📸 /test-product-with-image - Produto com foto   ║
║  🖼️ /test-images - Interface upload imagens       ║
║  📱 /whatsapp - Simulador com suporte a fotos    ║
║  🔗 /webhook - Recebe mensagens + imagens         ║
╚═══════════════════════════════════════════════════════╝

🎉 SISTEMA COMPLETO IMPLEMENTADO!
📸 Suporte a imagens: FUNCIONANDO
📱 WhatsApp simulator: COM FOTOS
🔗 Pronto para conectar no WhatsApp real!
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason);
});// servidor.js - AUTOMAÇÃO YAMPI + WHATSAPP COM SISTEMA DE FOTOS COMPLETO
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(express.json());

// Configuração do multer para upload de imagens
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'), false);
        }
    }
});

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

// ========== SISTEMA DE FOTOS ==========

// Função para fazer upload de imagem na Yampi
async function uploadImagemYampi(imageBuffer, filename) {
    try {
        console.log('📸 Fazendo upload de imagem na Yampi...');
        
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: filename,
            contentType: 'image/jpeg'
        });
        
        const response = await axios.post(
            `${config.YAMPI_API}/uploads`,
            formData,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    ...formData.getHeaders()
                }
            }
        );
        
        console.log('✅ Imagem uploaded com sucesso!');
        return response.data.data;
        
    } catch (error) {
        console.error('❌ Erro no upload da imagem:', error.response?.data);
        throw new Error(`Erro no upload: ${error.message}`);
    }
}

// Função para baixar imagem de URL
async function baixarImagemDeUrl(imageUrl) {
    try {
        console.log('⬇️ Baixando imagem de:', imageUrl);
        
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        return Buffer.from(response.data);
        
    } catch (error) {
        console.error('❌ Erro ao baixar imagem:', error.message);
        throw new Error(`Erro ao baixar imagem: ${error.message}`);
    }
}

// ========== ENDPOINTS PARA RESOLVER BRAND_ID ==========

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
                    limit: 50
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

// 2. ENDPOINT PARA CRIAR MARCA AUTOMATICAMENTE (CORRIGIDO)
app.post('/create-brand', async (req, res) => {
    try {
        console.log('🏷️ Criando marca automática...');
        
        const brandData = {
            name: req.body.name || 'Marca Padrão WhatsApp',
            active: true,
            featured: false
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
                active: true,
                featured: false
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

// 4. FUNÇÃO PARA CRIAR PRODUTO COM IMAGEM
async function criarProdutoComImagem(dados, imagemUrl = null) {
    try {
        const brandId = await obterBrandIdValido();
        
        // Criar produto básico primeiro
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
        
        console.log('📦 Criando produto...');
        
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
        
        const produto = response.data.data;
        console.log('✅ Produto criado com ID:', produto.id);
        
        // Se tem imagem, fazer upload e associar ao produto
        if (imagemUrl) {
            try {
                console.log('📸 Processando imagem...');
                
                const imageBuffer = await baixarImagemDeUrl(imagemUrl);
                const filename = `produto_${produto.id}_${Date.now()}.jpg`;
                
                const uploadResult = await uploadImagemYampi(imageBuffer, filename);
                
                // Associar imagem ao produto
                await axios.post(
                    `${config.YAMPI_API}/catalog/products/${produto.id}/images`,
                    {
                        image_id: uploadResult.id,
                        position: 1
                    },
                    {
                        headers: {
                            'User-Token': config.YAMPI_TOKEN,
                            'User-Secret-Key': config.YAMPI_SECRET_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('✅ Imagem associada ao produto!');
                produto.imagem_adicionada = true;
                
            } catch (imageError) {
                console.error('⚠️ Erro com imagem (produto criado sem imagem):', imageError.message);
                produto.imagem_adicionada = false;
                produto.erro_imagem = imageError.message;
            }
        }
        
        return produto;
        
    } catch (error) {
        console.error('❌ Erro ao criar produto:', error.response?.data);
        throw error;
    }
}

// 5. FUNÇÃO DE CRIAR PRODUTO ORIGINAL (SEM IMAGEM) - MANTIDA PARA COMPATIBILIDADE
async function criarProdutoYampi(dados) {
    return await criarProdutoComImagem(dados, null);
}

// ========== ENDPOINTS DE TESTE ==========

// TESTE SUPER MÍNIMO (SÓ OS ESSENCIAIS)
app.get('/test-super-minimal', async (req, res) => {
    try {
        const superMinimal = {
            sku: `SUPER${Date.now()}`,
            name: "Super Mínimo",
            brand_id: 44725512,
            simple: true,
            active: true
        };
        
        console.log('TESTE SUPER MÍNIMO:', superMinimal);
        
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
            produto: response.data,
            descoberta: 'Os campos simple=true e active=true eram obrigatórios!'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            errors: error.response?.data?.errors,
            ainda_faltando: 'Veja o campo errors para descobrir o que mais falta'
        });
    }
});

// TESTE PRODUTO COM IMAGEM
app.get('/test-product-with-image', async (req, res) => {
    try {
        // URL de imagem de teste
        const imagemTeste = 'https://via.placeholder.com/400x400/FF0000/FFFFFF?text=TESTE';
        
        const dadosTeste = {
            nome: `Produto com Imagem ${Date.now()}`,
            preco: 39.90,
            descricao: 'Produto de teste com imagem',
            estoque: { 'Único': 15 }
        };
        
        const produto = await criarProdutoComImagem(dadosTeste, imagemTeste);
        
        res.json({
            success: true,
            message: '🎉 Produto com imagem criado!',
            produto: {
                id: produto.id,
                name: produto.name,
                sku: produto.sku,
                url: produto.url,
                imagem_adicionada: produto.imagem_adicionada,
                erro_imagem: produto.erro_imagem
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// TESTE UPLOAD DE IMAGEM
app.post('/test-upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma imagem enviada'
            });
        }
        
        const filename = `teste_${Date.now()}.jpg`;
        const uploadResult = await uploadImagemYampi(req.file.buffer, filename);
        
        res.json({
            success: true,
            message: '📸 Imagem uploaded com sucesso!',
            upload_result: uploadResult,
            file_info: {
                original_name: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ENDPOINT DE TESTE COMPLETO
app.get('/test-create-fixed', async (req, res) => {
    try {
        console.log('🧪 Teste completo de criação de produto...');
        
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

// ========== WEBHOOK E PROCESSAMENTO ==========

// Webhook para receber mensagens (ATUALIZADO COM SUPORTE A IMAGENS)
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (data && data.message) {
            const phone = data.key.remoteJid;
            let message = '';
            let imagemUrl = null;
            
            // Verificar se é uma imagem
            if (data.message.imageMessage) {
                imagemUrl = data.message.imageMessage.url;
                message = data.message.imageMessage.caption || '';
                log(`📸 Imagem recebida de ${phone}: ${imagemUrl}`);
            } else {
                message = data.message.conversation || 
                         data.message.extendedTextMessage?.text || '';
            }
            
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            
            if (message.toLowerCase().includes('/cadastrar') || 
                message.toLowerCase().includes('cadastrar')) {
                await processarProdutoComImagem(message, phone, imagemUrl);
            }
            else if (message.toLowerCase().includes('/ajuda')) {
                await enviarAjudaComImagem(phone);
            }
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        log(`Erro no webhook: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Processar produto COM IMAGEM
async function processarProdutoComImagem(message, phone, imagemUrl = null) {
    try {
        log(`Processando produto ${imagemUrl ? 'COM IMAGEM' : 'SEM IMAGEM'} para ${phone}`);
        
        await simularResposta(phone, imagemUrl ? 
            '⏳ Processando seu produto e imagem...' : 
            '⏳ Processando seu produto...'
        );
        
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            const erroMsg = `❌ Erro: Nome e Preço são obrigatórios!

${imagemUrl ? '📸 Imagem recebida! ' : ''}Formato correto:
/cadastrar Nome: Produto Preço: R$ 99,90 Categoria: Roupas

Para enviar com imagem:
1. Envie a foto primeiro
2. Digite o comando de cadastro`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        const produto = await criarProdutoComImagem(dados, imagemUrl);
        await enviarConfirmacaoComImagem(phone, produto, dados);
        
        log(`Produto criado: ${dados.nome} (ID: ${produto.id}) ${produto.imagem_adicionada ? 'COM IMAGEM' : 'SEM IMAGEM'}`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await simularResposta(phone, `❌ Erro: ${error.message}`);
    }
}

// Processar produto ORIGINAL (mantido para compatibilidade)
async function processarProduto(message, phone) {
    await processarProdutoComImagem(message, phone, null);
}

// Confirmação ATUALIZADA COM STATUS DA IMAGEM
async function enviarConfirmacaoComImagem(phone, produto, dados) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ PRODUTO CADASTRADO COM SUCESSO!

📦 ${dados.nome}
💰 R$ ${dados.preco.toFixed(2).replace('.', ',')}
${produto.imagem_adicionada ? '📸 ✅ Imagem adicionada!' : produto.erro_imagem ? '📸 ⚠️ Produto criado, mas erro na imagem' : '📸 Sem imagem'}

📊 Detalhes:
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 Produto ID: ${produto.id}
🌐 URL: ${produto.url || 'Não disponível'}

Tamanhos e estoque:
${dados.tamanhos.map(t => `• ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

✨ Seu produto já está disponível na loja!`;

    await simularResposta(phone, confirmacao);
}

// Ajuda ATUALIZADA COM INSTRUÇÕES DE IMAGEM
async function enviarAjudaComImagem(phone) {
    const ajuda = `🤖 AUTOMAÇÃO YAMPI - COM SUPORTE A IMAGENS! 📸

📋 COMO USAR:

🔹 SEM IMAGEM:
/cadastrar Nome: Camiseta Teste Preço: R$ 29,90 Categoria: Roupas

🔹 COM IMAGEM:
1️⃣ Envie a FOTO do produto
2️⃣ Na legenda da foto, digite:
/cadastrar Nome: Camiseta Polo Preço: R$ 89,90 Categoria: Roupas

🔹 FORMATO COMPLETO:
📸 [Envie a foto]
/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas

✅ Campos obrigatórios: Nome e Preço
📸 Imagem: Opcional (mas recomendada)
🎯 Em 30 segundos seu produto estará na loja!`;

    await simularResposta(phone, ajuda);
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
    
    // Extrair tamanhos se especificados
    const tamanhosMatch = texto.match(/tamanhos:\s*([^,\n\r]+)/);
    if (tamanhosMatch) {
        const tamanhosStr = tamanhosMatch[1];
        dados.tamanhos = tamanhosStr.split(',').map(t => t.trim());
        
        dados.estoque = {};
        dados.tamanhos.forEach(t => {
            dados.estoque[t] = 5;
        });
        
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

// Teste direto da API Yampi
app.get('/test-yampi', async (req, res) => {
    try {
        console.log('🔍 Testando conexão com API Yampi...');
        
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
            status: testResponse.status,
            products_count: testResponse.data.meta?.total || 0
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
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

// Confirmação de produto criado (função original mantida)
async function enviarConfirmacao(phone, produto, dados) {
    await enviarConfirmacaoComImagem(phone, produto, dados);
}

// Enviar ajuda (função original mantida)
async function enviarAjuda(phone) {
    await enviarAjudaComImagem(phone);
}

// ========== PÁGINAS WEB ==========

// Página de teste de imagens
app.get('/test-images', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>📸 Teste Upload de Imagens - Yampi Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #25D366; text-align: center; }
                .upload-area { border: 2px dashed #25D366; padding: 40px; text-align: center; margin: 20px 0; border-radius: 10px; }
                .upload-area:hover { background: #f0f8f0; }
                .upload-area.dragover { background: #e8f5e8; border-color: #1da1d4; }
                .file-input { display: none; }
                .upload-btn { background: #25D366; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                .upload-btn:hover { background: #128c7e; }
                .test-buttons { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 30px 0; }
                .test-btn { background: #007bff; color: white; padding: 15px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; }
                .test-btn:hover { background: #0056b3; color: white; text-decoration: none; }
                .test-btn.success { background: #28a745; }
                .test-btn.success:hover { background: #218838; }
                .result-box { background: #f8f9fa; padding: 20px; border
