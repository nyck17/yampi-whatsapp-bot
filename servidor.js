// servidor.js - Automação Yampi + WhatsApp SIMPLIFICADA
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Configurações
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN,
    PORT: process.env.PORT || 3000
};

// Variáveis globais
let produtosPendentes = {};

// Logs
const logFile = path.join(__dirname, 'produtos.log');

function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(logFile, logMessage);
}

// Webhook para receber mensagens (Evolution API externa)
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (data && data.message) {
            const phone = data.key.remoteJid;
            const message = data.message.conversation || data.message.extendedTextMessage?.text || '';
            
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            
            if (message.toLowerCase().includes('/cadastrar') || 
                message.toLowerCase().includes('cadastrar')) {
                await processarProduto(message, phone);
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
        
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            log(`Dados inválidos: ${JSON.stringify(dados)}`);
            return;
        }
        
        const produto = await criarProdutoYampi(dados);
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
    }
}

// Extrair dados
function extrairDados(message) {
    const dados = {
        nome: '',
        preco: 0,
        tamanhos: [],
        estoque: {},
        categoria: ''
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
    }
    
    if (dados.tamanhos.length === 0) {
        dados.tamanhos = ['Único'];
        dados.estoque['Único'] = 10;
    }
    
    return dados;
}

// Criar produto na Yampi
async function criarProdutoYampi(dados) {
    const produtoData = {
        name: dados.nome,
        description: dados.nome,
        price: dados.preco,
        sku: gerarSKU(dados.nome),
        status: 'active',
        type: 'physical',
        track_quantity: true,
        has_variations: dados.tamanhos.length > 1,
        variations: []
    };
    
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
        produtoData.quantity = dados.estoque[dados.tamanhos[0]] || 10;
    }
    
    log(`Criando produto: ${JSON.stringify(produtoData, null, 2)}`);
    
    const response = await axios.post(
        `${config.YAMPI_API}/catalog/products`,
        produtoData,
        {
            headers: {
                'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
    
    return response.data.data;
}

function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
    return `${nomeClean}${timestamp}`;
}

// Rotas
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            yampi_store: !!process.env.YAMPI_STORE
        }
    });
});

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

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>🤖 Automação Yampi + WhatsApp</title></head>
            <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                <h1 style="color: #25D366;">🤖 Automação Yampi + WhatsApp</h1>
                <p><strong>Status:</strong> ✅ Online</p>
                
                <h3>📱 Como usar:</h3>
                <p>Configure seu WhatsApp Business API para enviar webhook para:</p>
                <code>${req.get('host')}/webhook</code>
                
                <h3>💡 Formato da mensagem:</h3>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Roupas
                </pre>
                
                <h3>📊 Links:</h3>
                <ul>
                    <li><a href="/status">Status da API</a></li>
                    <li><a href="/logs">Logs de Atividade</a></li>
                </ul>
            </body>
        </html>
    `);
});

app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║                 FUNCIONANDO                      ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE                             ║
║  ✅ Yampi: ${config.YAMPI_TOKEN ? 'CONFIGURADO' : 'PENDENTE'}                   ║
║  ✅ Webhook: /webhook                            ║
╚══════════════════════════════════════════════════╝
    `);
});
