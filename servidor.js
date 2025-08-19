// servidor.js - Automação GRATUITA Yampi + WhatsApp
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Configurações (gratuitas)
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN,
    EVOLUTION_API: process.env.EVOLUTION_API_URL,
    PORT: process.env.PORT || 3000
};

// Armazenar logs em arquivo (gratuito)
const logFile = path.join(__dirname, 'produtos.log');

// Função para registrar logs
function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(logFile, logMessage);
}

// Armazenar dados temporários de produtos (em memória)
let produtosPendentes = {};

// Webhook do WhatsApp (Evolution API)
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        const phone = data.key.remoteJid;
        const messageId = data.key.id;
        
        // Processar mensagem de texto
        if (data && data.message && data.message.conversation) {
            const message = data.message.conversation;
            log(`Mensagem recebida de ${phone}: ${message.substring(0, 50)}...`);
            
            // Processar comandos de cadastro
            if (message.toLowerCase().includes('/cadastrar') || 
                message.toLowerCase().includes('cadastrar')) {
                await processarProduto(message, phone, messageId);
            }
        }
        
        // Processar imagem
        else if (data && data.message && data.message.imageMessage) {
            log(`Imagem recebida de ${phone}`);
            await processarImagem(data.message.imageMessage, phone, messageId);
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        log(`Erro no webhook: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Processar imagem recebida
async function processarImagem(imageMessage, phone, messageId) {
    try {
        // Salvar imagem temporariamente para este usuário
        if (!produtosPendentes[phone]) {
            produtosPendentes[phone] = {};
        }
        
        // Baixar a imagem
        const imagemUrl = await baixarImagem(imageMessage, phone);
        produtosPendentes[phone].imagem = imagemUrl;
        
        await enviarMensagem(phone, `📷 *Imagem recebida!*

Agora envie os dados do produto no formato:

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

// Baixar imagem da Evolution API
async function baixarImagem(imageMessage, phone) {
    try {
        // Obter a imagem da Evolution API
        const response = await axios.get(
            `${config.EVOLUTION_API}/chat/getBase64FromMediaMessage`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EVOLUTION_APIKEY || 'sua_api_key'
                },
                params: {
                    message: imageMessage
                }
            }
        );
        
        const base64Image = response.data.base64;
        
        // Upload da imagem para um serviço gratuito (ImgBB)
        const imgbbResponse = await axios.post(
            'https://api.imgbb.com/1/upload',
            {
                key: process.env.IMGBB_API_KEY || 'sua_chave_imgbb', // Chave gratuita
                image: base64Image
            }
        );
        
        return imgbbResponse.data.data.url;
        
    } catch (error) {
        log(`Erro ao baixar imagem: ${error.message}`);
        // Retornar URL vazia se houver erro
        return '';
    }
}
async function processarProduto(message, phone, messageId) {
    try {
        log(`Iniciando processamento do produto para ${phone}`);
        
        // Enviar mensagem de processamento
        await enviarMensagem(phone, '⏳ Processando seu produto...\nAguarde um momento!');
        
        // 1. Extrair dados da mensagem
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            await enviarMensagem(phone, '❌ Erro: Nome e Preço são obrigatórios!\n\nFormato correto:\nNome: Produto\nPreço: R$ 99,90\nTamanhos: P,M,G\nEstoque: P=5,M=10,G=8\nCategoria: Roupas');
            return;
        }
        
        // 2. Criar produto na Yampi
        const produto = await criarProdutoYampi(dados);
        
        // 3. Confirmar sucesso
        await enviarConfirmacao(phone, produto, dados);
        
        log(`Produto criado com sucesso: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await enviarMensagem(phone, `❌ Erro: ${error.message}\n\nTente novamente ou verifique os dados.`);
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

// Enviar mensagem via Evolution API
async function enviarMensagem(phone, message) {
    try {
        const response = await axios.post(
            `${config.EVOLUTION_API}/message/sendText`,
            {
                number: phone,
                textMessage: {
                    text: message
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': 'sua_api_key' // Configure no Evolution
                }
            }
        );
        
        log(`Mensagem enviada para ${phone}: ${message.substring(0, 30)}...`);
        return response.data;
    } catch (error) {
        log(`Erro ao enviar mensagem: ${error.message}`);
        throw error;
    }
}

// Enviar confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, imagemUrl = '') {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ *Produto cadastrado com sucesso!*

📦 *${dados.nome}*
💰 *R$ ${dados.preco.toFixed(2).replace('.', ',').replace(',', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')}*
${imagemUrl ? '📷 *Com imagem anexada!*' : ''}

📊 *Detalhes:*
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 *Produto ID:* ${produto.id}

*Tamanhos e estoque:*
${dados.tamanhos.map(t => `• ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

✨ *Seu produto já está disponível na loja!*`;

    await enviarMensagem(phone, confirmacao);
}

// Rota de status (para monitoramento)
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            evolution_configured: !!config.EVOLUTION_API
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

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    log(`🔗 Status: http://localhost:${config.PORT}/status`);
    log(`📝 Logs: http://localhost:${config.PORT}/logs`);
    
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║                 100% GRATUITA                    ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE                             ║
║  ✅ Porta: ${config.PORT}                                  ║
║  ✅ Yampi: ${config.YAMPI_TOKEN ? 'CONFIGURADO' : 'PENDENTE'}                   ║
║  ✅ Evolution: ${config.EVOLUTION_API ? 'CONFIGURADO' : 'PENDENTE'}              ║
╠══════════════════════════════════════════════════╣
║              COMO USAR:                          ║
║  1. Envie no WhatsApp:                           ║
║     /cadastrar                                   ║
║     Nome: Camiseta Polo                          ║
║     Preço: R$ 89,90                              ║
║     Tamanhos: P,M,G                              ║
║     Estoque: P=5,M=10,G=8                        ║
║     Categoria: Roupas                            ║
║                                                  ║
║  2. Aguarde a confirmação                        ║
║  3. Produto estará na sua loja!                  ║
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