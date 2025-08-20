// servidor.js - Automação COMPLETA Yampi + WhatsApp (Baileys integrado)
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const app = express();
app.use(express.json());

// Configurações (gratuitas)
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN,
    PORT: process.env.PORT || 3000
};

// Variáveis globais
let sock;
let qrCode = '';
let isConnected = false;
let produtosPendentes = {};

// Armazenar logs em arquivo (gratuito)
const logFile = path.join(__dirname, 'produtos.log');

// Função para registrar logs
function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(logFile, logMessage);
}

// Inicializar WhatsApp
async function initWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCode = qr;
                log('QR Code gerado - acesse /qr para ver');
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                log(`Conexão fechada devido a ${lastDisconnect?.error}, reconectando: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    initWhatsApp();
                }
                isConnected = false;
            } else if (connection === 'open') {
                log('WhatsApp conectado com sucesso!');
                isConnected = true;
                qrCode = '';
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (!message.key.fromMe && message.message) {
                await processarMensagem(message);
            }
        });

    } catch (error) {
        log(`Erro ao inicializar WhatsApp: ${error.message}`);
        setTimeout(initWhatsApp, 5000); // Tentar novamente em 5s
    }
}

// Processar mensagem recebida
async function processarMensagem(message) {
    try {
        const phone = message.key.remoteJid;
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || '';
        
        log(`Mensagem de ${phone}: ${messageText.substring(0, 50)}...`);
        
        // Processar imagem
        if (message.message?.imageMessage) {
            await processarImagem(message.message.imageMessage, phone);
            return;
        }
        
        // Processar comando de cadastro
        if (messageText.toLowerCase().includes('/cadastrar') || 
            messageText.toLowerCase().includes('cadastrar')) {
            await processarProduto(messageText, phone);
        }
        
        // Comandos de ajuda
        if (messageText.toLowerCase().includes('/ajuda') || 
            messageText.toLowerCase().includes('ajuda')) {
            await enviarMensagem(phone, `🤖 *AUTOMAÇÃO YAMPI*

📝 *Como usar:*

1️⃣ Envie uma foto do produto (opcional)
2️⃣ Envie os dados:

/cadastrar
Nome: Nome do produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Categoria

✅ *Campos obrigatórios:* Nome e Preço
🎯 *Em 30 segundos* seu produto estará na loja!

Digite /exemplo para ver um exemplo completo.`);
        }
        
        if (messageText.toLowerCase().includes('/exemplo')) {
            await enviarMensagem(phone, `📋 *EXEMPLO COMPLETO:*

📷 [Envie foto do produto]

Depois envie:

/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas
Descrição: Camiseta polo 100% algodão

✅ *Resultado:* Produto com foto na sua loja Yampi!`);
        }
        
    } catch (error) {
        log(`Erro ao processar mensagem: ${error.message}`);
    }
}

// Processar imagem recebida
async function processarImagem(imageMessage, phone) {
    try {
        // Salvar referência da imagem para este usuário
        if (!produtosPendentes[phone]) {
            produtosPendentes[phone] = {};
        }
        
        // Download da imagem usando Baileys
        const buffer = await downloadMediaMessage(imageMessage, 'buffer');
        
        // Converter para base64 para upload
        const base64Image = buffer.toString('base64');
        
        // Upload gratuito para ImgBB (ou usar serviço similar)
        const imagemUrl = await uploadImagem(base64Image);
        
        produtosPendentes[phone].imagem = imagemUrl;
        
        await enviarMensagem(phone, `📷 *Imagem recebida!*

Agora envie os dados do produto:

/cadastrar
Nome: Nome do produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Categoria

_A imagem será adicionada automaticamente!_`);
        
        log(`Imagem salva para ${phone}: ${imagemUrl}`);
        
    } catch (error) {
        log(`Erro ao processar imagem: ${error.message}`);
        await enviarMensagem(phone, '❌ Erro ao processar imagem. Tente enviar novamente.');
    }
}

// Upload de imagem (usando serviço gratuito)
async function uploadImagem(base64Image) {
    try {
        // Usando ImgBB gratuito
        const response = await axios.post(
            'https://api.imgbb.com/1/upload',
            {
                key: process.env.IMGBB_API_KEY || 'sua_chave_gratuita',
                image: base64Image
            }
        );
        
        return response.data.data.url;
        
    } catch (error) {
        log(`Erro ao fazer upload: ${error.message}`);
        return ''; // Retornar vazio se houver erro
    }
}

// Download de mídia usando Baileys
async function downloadMediaMessage(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// Função principal para processar produto
async function processarProduto(message, phone) {
    try {
        log(`Iniciando processamento do produto para ${phone}`);
        
        // Enviar mensagem de processamento
        await enviarMensagem(phone, '⏳ Processando seu produto...\nAguarde um momento!');
        
        // 1. Extrair dados da mensagem
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            await enviarMensagem(phone, `❌ *Erro: Nome e Preço são obrigatórios!*

📋 *Formato correto:*
Nome: Produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Roupas

📷 *Dica:* Envie a foto ANTES dos dados!
💡 Digite /exemplo para ver exemplo completo.`);
            return;
        }
        
        // 2. Verificar se há imagem pendente para este usuário
        let imagemUrl = '';
        if (produtosPendentes[phone] && produtosPendentes[phone].imagem) {
            imagemUrl = produtosPendentes[phone].imagem;
            // Limpar dados pendentes
            delete produtosPendentes[phone];
            log(`Usando imagem pendente: ${imagemUrl}`);
        }
        
        // 3. Criar produto na Yampi
        const produto = await criarProdutoYampi(dados, imagemUrl);
        
        // 4. Confirmar sucesso
        await enviarConfirmacao(phone, produto, dados, imagemUrl);
        
        log(`Produto criado com sucesso: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await enviarMensagem(phone, `❌ *Erro:* ${error.message}

🔧 *Possíveis soluções:*
• Verifique se Nome e Preço estão corretos
• Use formato: Nome: valor (com dois pontos)
• Preço: R$ 99,90 (com R$)

💡 Digite /exemplo para ver formato correto.`);
    }
}

// Extrair dados da mensagem
function extrairDados(message) {
    const dados = {
        nome: '',
        preco: 0,
        tamanhos: [],
        estoque: {},
        categoria: '',
        descricao: ''
    };
    
    const lines = message.split('\n');
    
    for (const line of lines) {
        const lower = line.toLowerCase().trim();
        
        if (lower.startsWith('nome:')) {
            dados.nome = line.split(':')[1].trim();
        }
        else if (lower.startsWith('preço:') || lower.startsWith('preco:')) {
            const precoStr = line.split(':')[1].trim();
            dados.preco = parseFloat(precoStr.replace('r$', '').replace(',', '.').trim());
        }
        else if (lower.startsWith('tamanhos:')) {
            const tamanhosStr = line.split(':')[1].trim();
            dados.tamanhos = tamanhosStr.split(',').map(t => t.trim());
        }
        else if (lower.startsWith('estoque:')) {
            const estoqueStr = line.split(':')[1].trim();
            const estoqueItems = estoqueStr.split(',');
            
            for (const item of estoqueItems) {
                if (item.includes('=')) {
                    const [tamanho, quantidade] = item.split('=');
                    dados.estoque[tamanho.trim()] = parseInt(quantidade.trim()) || 0;
                }
            }
        }
        else if (lower.startsWith('categoria:')) {
            dados.categoria = line.split(':')[1].trim();
        }
        else if (lower.startsWith('descrição:') || lower.startsWith('descricao:')) {
            dados.descricao = line.split(':')[1].trim();
        }
    }
    
    // Se não tiver tamanhos, usar padrão
    if (dados.tamanhos.length === 0) {
        dados.tamanhos = ['Único'];
        dados.estoque['Único'] = 10; // Estoque padrão
    }
    
    return dados;
}

// Criar produto na Yampi
async function criarProdutoYampi(dados, imagemUrl = '') {
    // Preparar dados do produto
    const produtoData = {
        name: dados.nome,
        description: dados.descricao || dados.nome,
        price: dados.preco,
        sku: gerarSKU(dados.nome),
        status: 'active',
        type: 'physical',
        track_quantity: true,
        has_variations: dados.tamanhos.length > 1,
        variations: []
    };
    
    // Adicionar imagem se disponível
    if (imagemUrl) {
        produtoData.images = [{
            src: imagemUrl,
            alt: dados.nome
        }];
    }
    
    // Criar variações se houver tamanhos
    if (dados.tamanhos.length > 1) {
        for (const tamanho of dados.tamanhos) {
            const estoque = dados.estoque[tamanho] || 0;
            
            produtoData.variations.push({
                values: [{ name: 'Tamanho', value: tamanho }],
                sku: `${produtoData.sku}-${tamanho}`,
                price: dados.preco,
                quantity: estoque,
                track_quantity: true
            });
        }
    } else {
        // Produto simples
        produtoData.quantity = dados.estoque[dados.tamanhos[0]] || 10;
    }
    
    log(`Criando produto: ${JSON.stringify(produtoData, null, 2)}`);
    
    // Fazer requisição para Yampi
    const response = await axios.post(
        `${config.YAMPI_API}/catalog/products`,
        produtoData,
        {
            headers: {
                'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Automacao-WhatsApp/1.0'
            }
        }
    );
    
    return response.data.data;
}

// Gerar SKU único
function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
    return `${nomeClean}${timestamp}`;
}

// Enviar mensagem via Baileys
async function enviarMensagem(phone, message) {
    try {
        if (!isConnected) {
            log('WhatsApp não conectado - mensagem não enviada');
            return;
        }
        
        await sock.sendMessage(phone, { text: message });
        log(`Mensagem enviada para ${phone}: ${message.substring(0, 30)}...`);
        
    } catch (error) {
        log(`Erro ao enviar mensagem: ${error.message}`);
    }
}

// Enviar confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, imagemUrl = '') {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ *Produto cadastrado com sucesso!*

📦 *${dados.nome}*
💰 *R$ ${dados.preco.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')}*
${imagemUrl ? '📷 *Com imagem anexada!*' : ''}

📊 *Detalhes:*
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 *Produto ID:* ${produto.id}

*Tamanhos e estoque:*
${dados.tamanhos.map(t => `• ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

✨ *Seu produto já está disponível na loja!*

💡 Digite /ajuda para ver outros comandos.`;

    await enviarMensagem(phone, confirmacao);
}

// Rota para QR Code
app.get('/qr', (req, res) => {
    if (qrCode) {
        const QRCode = require('qrcode');
        QRCode.toDataURL(qrCode, (err, url) => {
            if (err) {
                res.status(500).send('Erro ao gerar QR Code');
            } else {
                res.send(`
                    <html>
                        <head><title>WhatsApp QR Code</title></head>
                        <body style="text-align: center; font-family: Arial;">
                            <h1>🚀 Automação Yampi + WhatsApp</h1>
                            <h2>📱 Escaneie com seu WhatsApp:</h2>
                            <img src="${url}" style="border: 2px solid #25D366; border-radius: 10px;">
                            <p><strong>Como escanear:</strong></p>
                            <ol style="text-align: left; max-width: 400px; margin: 0 auto;">
                                <li>Abra WhatsApp no seu celular</li>
                                <li>Vá em Configurações > Aparelhos conectados</li>
                                <li>Clique "Conectar um aparelho"</li>
                                <li>Escaneie este QR Code</li>
                            </ol>
                            <p><em>Atualize a página se o QR Code não carregar</em></p>
                        </body>
                    </html>
                `);
            }
        });
    } else {
        res.send(`
            <html>
                <head>
                    <title>WhatsApp Status</title>
                    <meta http-equiv="refresh" content="3">
                </head>
                <body style="text-align: center; font-family: Arial;">
                    <h1>🤖 Automação Yampi + WhatsApp</h1>
                    ${isConnected ? 
                        '<h2 style="color: green;">✅ WhatsApp Conectado!</h2><p>Sua automação está funcionando!</p>' :
                        '<h2 style="color: orange;">⏳ Gerando QR Code...</h2><p>Aguarde alguns segundos...</p>'
                    }
                </body>
            </html>
        `);
    }
});

// Rota de status (para monitoramento)
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        whatsapp_connected: isConnected,
        timestamp: new Date().toISOString(),
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            yampi_store: !!process.env.YAMPI_STORE
        }
    });
});

// Rota para listar últimos produtos (opcional)
app.get('/logs', (req, res) => {
    try {
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8').split('\n').slice(-50);
            res.json({ logs: logs.filter(log => log.trim()) });
        } else {
            res.json({ logs: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>🤖 Automação Yampi + WhatsApp</title></head>
            <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                <h1 style="color: #25D366;">🤖 Automação Yampi + WhatsApp</h1>
                <p><strong>Status:</strong> ${isConnected ? '✅ Conectado' : '❌ Desconectado'}</p>
                
                <h3>📱 Links Úteis:</h3>
                <ul>
                    <li><a href="/qr">📲 Conectar WhatsApp (QR Code)</a></li>
                    <li><a href="/status">📊 Status da API</a></li>
                    <li><a href="/logs">📝 Logs de Atividade</a></li>
                </ul>
                
                <h3>💡 Como Usar:</h3>
                <ol>
                    <li>Conecte seu WhatsApp usando o QR Code</li>
                    <li>Envie foto do produto (opcional)</li>
                    <li>Envie dados no formato:</li>
                </ol>
                
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Roupas
                </pre>
                
                <p><em>Em 30 segundos seu produto estará na loja Yampi!</em></p>
                
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Desenvolvido com ❤️ - 100% Gratuito
                </p>
            </body>
        </html>
    `);
});

// Inicializar WhatsApp ao iniciar servidor
initWhatsApp();

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    log(`🔗 Acesse: http://localhost:${config.PORT}`);
    log(`📱 QR Code: http://localhost:${config.PORT}/qr`);
    log(`📊 Status: http://localhost:${config.PORT}/status`);
    
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║              TUDO INTEGRADO + GRATUITO           ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE                             ║
║  ✅ Porta: ${config.PORT}                                  ║
║  ✅ Yampi: ${config.YAMPI_TOKEN ? 'CONFIGURADO' : 'PENDENTE'}                   ║
║  ✅ WhatsApp: INICIALIZANDO...                   ║
╠══════════════════════════════════════════════════╣
║              COMO USAR:                          ║
║  1. Acesse /qr para conectar WhatsApp            ║
║  2. Envie foto + dados no WhatsApp               ║
║  3. Produto criado automaticamente!              ║
╚══════════════════════════════════════════════════╝
    `);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    log(`Erro não capturado: ${error.message}`);
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Promise rejeitada: ${reason}`);
    console.error('Promise rejeitada:', reason);
});
