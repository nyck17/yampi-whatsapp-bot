// servidor.js - VERSÃO DEFINITIVA - Alinhado com a Documentação Oficial da Yampi
const express = require('express');
const axios = require('axios');
const fs = require('fs'); // Módulo para manipulação de arquivos

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES ---
// (Se você usa um arquivo .env, estas variáveis virão de lá)
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE || 'sua-loja'}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN || 'SEU_TOKEN_AQUI',
    YAMPI_SECRET_KEY: process.env.YAMPI_SECRET_KEY || 'SUA_SECRET_KEY_AQUI',
    PORT: process.env.PORT || 3000
};

// --- MAPEAMENTO DE VARIAÇÕES ---
// IDs das variações e seus valores. ESSENCIAL para a nova abordagem.
// VERIFIQUE NO PAINEL DA YAMPI SE ESSES NÚMEROS CORRESPONDEM AOS DA SUA LOJA
const YAMPI_VARIATIONS = {
    TAMANHO: {
        variation_id: 1190509,
        values: {
            'P': 18183531,
            'M': 18183532,
            'G': 18183533,
            'GG': 18183534
        }
    }
};

// --- VARIÁVEIS GLOBAIS ---
let simulatedMessages = [];

// --- FUNÇÕES AUXILIARES ---

// Logs simples no console e para o simulador
function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    simulatedMessages.push({ timestamp, message: logMessage, type: 'log' });
    if (simulatedMessages.length > 100) simulatedMessages.shift();
}

// Busca o ID da primeira marca cadastrada na loja
async function obterBrandIdValido() {
    try {
        const response = await axios.get(`${config.YAMPI_API}/catalog/brands`, {
            headers: { 'User-Token': config.YAMPI_TOKEN, 'User-Secret-Key': config.YAMPI_SECRET_KEY },
            params: { limit: 1 }
        });
        const brands = response.data.data || [];
        if (brands.length > 0) {
            log(`✅ Marca encontrada: ${brands[0].name} (ID: ${brands[0].id})`);
            return brands[0].id;
        }
        throw new Error("Nenhuma marca encontrada na loja.");
    } catch (error) {
        log(`⚠ Erro ao obter brand_id: ${error.message}. Verifique as credenciais e se há marcas cadastradas.`);
        throw error;
    }
}

// Gera um SKU único baseado no nome e no tempo
function gerarSKU(nome, length = 6) {
    const timestamp = Date.now().toString().slice(-length);
    const nomeClean = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return `${nomeClean}${timestamp}`;
}

// Extrai as informações da mensagem do WhatsApp
function extrairDados(message) {
    const dados = { nome: '', preco: 0, desconto: null, precoPromocional: null, tamanhos: ['Único'], estoque: { 'Único': 10 }, descricao: '' };
    const texto = message.toLowerCase();
    const nomeMatch = texto.match(/nome:\s*([^,\n\r]+)/);
    if (nomeMatch) dados.nome = nomeMatch[1].trim();
    const precoMatch = texto.match(/pre[çc]o:\s*r?\$?\s*([\d,\.]+)/);
    if (precoMatch) dados.preco = parseFloat(precoMatch[1].replace(',', '.'));
    const descontoMatch = texto.match(/desconto:\s*(\d+)%/);
    if (descontoMatch) dados.desconto = parseInt(descontoMatch[1]);
    const promocionalMatch = texto.match(/promocional:\s*r?\$?\s*([\d,\.]+)/);
    if (promocionalMatch) dados.precoPromocional = parseFloat(promocionalMatch[1].replace(',', '.'));
    const descricaoMatch = texto.match(/descri[çc][ãa]o:\s*([^,\n\r]+)/);
    if (descricaoMatch) dados.descricao = descricaoMatch[1].trim();
    const tamanhosMatch = texto.match(/tamanhos:\s*([^,\n\r]+)/);
    if (tamanhosMatch) {
        dados.tamanhos = tamanhosMatch[1].split(',').map(t => t.trim().toUpperCase());
        dados.estoque = {};
        dados.tamanhos.forEach(t => { dados.estoque[t] = 5; });
        const estoqueMatch = texto.match(/estoque:\s*([^,\n\r]+)/);
        if (estoqueMatch) {
            estoqueMatch[1].split(',').forEach(item => {
                if (item.includes('=')) {
                    const [tamanho, quantidade] = item.split('=');
                    const t = tamanho.trim().toUpperCase();
                    if (dados.tamanhos.includes(t)) dados.estoque[t] = parseInt(quantidade.trim()) || 0;
                }
            });
        }
    }
    return dados;
}

// --- FUNÇÃO PRINCIPAL ---
async function criarProdutoCompleto(dados) {
    try {
        const brandId = await obterBrandIdValido();
        const precoVenda = parseFloat(dados.preco);
        let precoPromocional = null;
        if (dados.desconto) precoPromocional = precoVenda * (1 - dados.desconto / 100);
        else if (dados.precoPromocional) precoPromocional = parseFloat(dados.precoPromocional);

        log('🚀 Montando payload para a API oficial da Yampi...');

        const skus = dados.tamanhos.map(tamanho => {
            const valueId = YAMPI_VARIATIONS.TAMANHO.values[tamanho.toUpperCase()];
            if (!valueId) {
                log(`❌ Tamanho inválido "${tamanho}" não encontrado no mapeamento.`);
                return null;
            }
            return {
                sku: `${gerarSKU(dados.nome, 4)}-${tamanho.toUpperCase()}`,
                quantity: dados.estoque[tamanho] || 0,
                price_sale: precoVenda.toString(),
                ...(precoPromocional && { price_discount: precoPromocional.toString() }),
                active: true,
                variations_values_ids: [valueId]
            };
        }).filter(Boolean);

        if (skus.length !== dados.tamanhos.length) throw new Error("Um ou mais tamanhos são inválidos.");

        const yampiPayload = {
            name: dados.nome,
            description: dados.descricao || `${dados.nome} - Produto de qualidade`,
            brand_id: brandId,
            active: true,
            has_variations: true,
            simple: false,
            weight: 0.5, height: 10, width: 15, length: 20,
            skus: skus
        };

        log('📦 Enviando produto e SKUs diretamente para a Yampi...');
        
        const endpoint = `${config.YAMPI_API}/catalog/products`;
        const headers = {
            'User-Token': config.YAMPI_TOKEN,
            'User-Secret-Key': config.YAMPI_SECRET_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const response = await axios.post(endpoint, yampiPayload, { headers });
        const produtoCriado = response.data.data;
        log(`✅ Produto criado com sucesso na Yampi! ID: ${produtoCriado.id}`);
        return produtoCriado;

    } catch (error) {
        const errorData = error.response?.data;
        log(`❌ ERRO GERAL ao criar produto na Yampi: ${JSON.stringify(errorData, null, 2) || error.message}`);
        throw new Error(errorData?.errors ? JSON.stringify(errorData.errors) : 'Erro na API da Yampi.');
    }
}

// --- ROTAS DO SERVIDOR ---

// Webhook para receber mensagens
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        if (data && data.message) {
            const phone = data.key.remoteJid;
            let message = data.message.conversation || data.message.extendedTextMessage?.text || data.message.imageMessage?.caption || '';
            if (!message) return res.status(200).json({ success: true });
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            if (message.toLowerCase().includes('/cadastrar')) await processarProduto(message, phone);
            else if (message.toLowerCase().includes('/ajuda')) await enviarAjuda(phone);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        log(`Erro no webhook: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

async function processarProduto(message, phone) {
    try {
        await simularResposta(phone, `⏳ Processando seu produto...`);
        const dados = extrairDados(message);
        if (!dados.nome || !dados.preco) {
            await simularResposta(phone, `⚠ Erro: Nome e Preço são obrigatórios!`);
            return;
        }
        const produto = await criarProdutoCompleto(dados);
        await enviarConfirmacao(phone, produto, dados);
    } catch (error) {
        await simularResposta(phone, `⚠ Erro ao criar o produto: ${error.message}`);
    }
}

async function enviarConfirmacao(phone, produto, dados) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + (b || 0), 0);
    const confirmacao = `✅ PRODUTO CRIADO COM SUCESSO!\n📦 ${dados.nome}\n\n🎯 STATUS DA CRIAÇÃO:\n• Produto: ✅ Criado Diretamente na Yampi\n• Variações: ✅ ${dados.tamanhos.join(', ')}\n• Estoque Total: ✅ ${totalEstoque} unidades\n\n🔗 Produto ID: ${produto.id}\n🌐 Painel: https://painel.yampi.com.br/catalog/products/${produto.id}\n\n🎉 PRODUTO PRONTO PARA VENDA!`;
    await simularResposta(phone, confirmacao);
}

async function enviarAjuda(phone) {
    const ajuda = `🤖 AJUDA - AUTOMAÇÃO YAMPI\n\n🔹 PRODUTO COMPLETO (EXEMPLO):\n/cadastrar\nNome: Camiseta Premium\nPreço: R$ 150,00\nTamanhos: P,M,G,GG\nEstoque: P=3,M=8,G=5,GG=2\n\n✅ Campos obrigatórios: Nome e Preço`;
    await simularResposta(phone, ajuda);
}

async function simularResposta(phone, message) {
    const resposta = { timestamp: new Date().toLocaleString('pt-BR'), phone, message, type: 'resposta' };
    simulatedMessages.push(resposta);
    log(`Resposta simulada para ${phone}: ${message.substring(0, 50)}...`);
}

// Rota de Teste Rápido
app.get('/test-create', async (req, res) => {
    try {
        const dadosTeste = {
            nome: `Produto Teste Yampi ${Date.now()}`, preco: 129.90, desconto: 15,
            tamanhos: ['P', 'M', 'G', 'GG'], estoque: { 'P': 2, 'M': 5, 'G': 6, 'GG': 3 },
            descricao: 'Produto de teste completo criado diretamente na Yampi'
        };
        log('🚀 INICIANDO TESTE DE CRIAÇÃO DIRETA NA YAMPI...');
        const produto = await criarProdutoCompleto(dadosTeste);
        res.json({
            success: true, message: '✅ PRODUTO DE TESTE CRIADO DIRETAMENTE NA YAMPI!',
            produto: { id: produto.id, name: produto.name },
            verificar_painel: `https://painel.yampi.com.br/catalog/products/${produto.id}`
        });
    } catch (error) {
        log(`❌ ERRO NO ENDPOINT DE TESTE: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rotas da Interface
app.get('/', (req, res) => res.send(`<h1>Servidor da Automação Yampi no ar.</h1><p><a href="/test-create">Clique aqui para fazer um teste rápido.</a></p><p><a href="/whatsapp">Clique aqui para ir ao simulador de WhatsApp.</a></p>`));
app.get('/messages', (req, res) => res.json({ messages: simulatedMessages }));
app.get('/whatsapp', (req, res) => {
    // Código da página do simulador
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>WhatsApp Simulator</title><style>body{font-family:sans-serif;max-width:450px;margin:20px auto;background:#e5ddd5}#chat{background:#ece5dd;height:400px;overflow-y:auto;padding:10px;border:1px solid #ccc}.msg{margin:10px 0;padding:10px;border-radius:8px;max-width:85%}.sent{background:#dcf8c6;margin-left:auto}.received{background:white}#input{display:flex;padding:10px}textarea{flex:1;padding:10px;border-radius:15px;margin-right:10px}button{background:#075e54;color:white;border:none;border-radius:50%;width:50px;height:50px;cursor:pointer}</style></head><body><div id="chat-container"><div id="chat"></div><div id="input"><textarea id="messageInput" placeholder="Digite sua mensagem..."></textarea><button onclick="sendMessage()">▶</button></div></div><script>const chat=document.getElementById('chat'),input=document.getElementById('messageInput');async function sendMessage(){const msg=input.value.trim();if(!msg)return;addMessage(msg,'sent');input.value='';const webhookData={data:{key:{remoteJid:'test-user@s.whatsapp.net'},message:{conversation:msg}}};await fetch('/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(webhookData)});setTimeout(loadMessages,1500)}function addMessage(text,type){const div=document.createElement('div');div.className='msg '+type;div.innerText=text;chat.appendChild(div);chat.scrollTop=chat.scrollHeight}async function loadMessages(){const res=await fetch('/messages');const data=await res.json();const lastResponse=data.messages.filter(m=>m.type==='resposta').pop();if(lastResponse)addMessage(lastResponse.message,'received')}</script></body></html>`);
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(config.PORT, () => {
    log(`🚀 Servidor DEFINITIVO rodando na porta ${config.PORT}`);
    log(`✅ Automação configurada para comunicação direta com a Yampi.`);
    log(`🔗 Acesse http://localhost:${config.PORT} para a interface.`);
});

// --- TRATAMENTO DE ERROS GLOBAIS ---
process.on('uncaughtException', (error) => { log(`❌ Erro não capturado: ${error.stack}`); });
process.on('unhandledRejection', (reason) => { log(`❌ Promise rejeitada: ${reason}`); });
