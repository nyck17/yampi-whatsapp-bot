// servidor.js - VERSÃO FINAL 4.1 - Pausa Estratégica ANTES de Buscar o Produto
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES ---
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE || 'sua-loja'}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN || 'SEU_TOKEN_AQUI',
    YAMPI_SECRET_KEY: process.env.YAMPI_SECRET_KEY || 'SUA_SECRET_KEY_AQUI',
    PORT: process.env.PORT || 3000
};

// --- MAPEAMENTO DE VARIAÇÕES ---
const YAMPI_VARIATIONS = {
    TAMANHO: {
        variation_id: 1190509,
        values: { 'P': 18183531, 'M': 18183532, 'G': 18183533, 'GG': 18183534 }
    }
};

let simulatedMessages = [];

function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    simulatedMessages.push({ timestamp, message: logMessage, type: 'log' });
    if (simulatedMessages.length > 100) simulatedMessages.shift();
}

async function obterBrandIdValido() {
    try {
        const response = await axios.get(`${config.YAMPI_API}/catalog/brands`, {
            headers: { 'User-Token': config.YAMPI_TOKEN, 'User-Secret-Key': config.YAMPI_SECRET_KEY },
            params: { limit: 1 }
        });
        const brands = response.data.data || [];
        if (brands.length > 0) return brands[0].id;
        throw new Error("Nenhuma marca encontrada.");
    } catch (error) {
        log(`⚠ Erro ao obter brand_id: ${error.message}`);
        throw error;
    }
}

function gerarSKU(nome, length = 6) {
    const timestamp = Date.now().toString().slice(-length);
    const nomeClean = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return `${nomeClean}${timestamp}`;
}

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
    const brandId = await obterBrandIdValido();
    const precoVenda = parseFloat(dados.preco);
    let precoPromocional = null;
    if (dados.desconto) precoPromocional = precoVenda * (1 - dados.desconto / 100);
    else if (dados.precoPromocional) precoPromocional = parseFloat(dados.precoPromocional);

    const headers = {
        'User-Token': config.YAMPI_TOKEN, 'User-Secret-Key': config.YAMPI_SECRET_KEY,
        'Content-Type': 'application/json', 'Accept': 'application/json'
    };

    // --- PASSO 1: Criar o Produto e Suas Variações ---
    log('🚀 PASSO 1: Criando o produto e as variações...');
    const skusPayload = dados.tamanhos.map(tamanho => {
        const valueId = YAMPI_VARIATIONS.TAMANHO.values[tamanho.toUpperCase()];
        if (!valueId) { log(`❌ Tamanho inválido "${tamanho}"`); return null; }
        return {
            sku: `${gerarSKU(dados.nome, 4)}-${tamanho.toUpperCase()}`, price_sale: precoVenda.toString(),
            price_cost: (precoVenda * 0.6).toFixed(2), blocked_sale: false,
            weight: 0.5, height: 10, width: 15, length: 20,
            ...(precoPromocional && { price_discount: precoPromocional.toString() }),
            active: true, variations_values_ids: [valueId]
        };
    }).filter(Boolean);
    if (skusPayload.length !== dados.tamanhos.length) throw new Error("Um ou mais tamanhos são inválidos.");

    const productPayload = {
        name: dados.nome, description: dados.descricao || `${dados.nome} - Produto de qualidade`,
        brand_id: brandId, active: true, has_variations: true, simple: false,
        weight: 0.5, height: 10, width: 15, length: 20,
        skus: skusPayload
    };

    let produtoCriado;
    try {
        const response = await axios.post(`${config.YAMPI_API}/catalog/products`, productPayload, { headers });
        produtoCriado = response.data.data;
        log(`✅ PASSO 1 finalizado! ID do Produto: ${produtoCriado.id}`);
    } catch (error) {
        log(`❌ ERRO no PASSO 1: ${JSON.stringify(error.response?.data)}`);
        throw new Error("Falha ao criar o produto base.");
    }
    
    // --- PASSO 2: Ativar o Gerenciamento de Estoque no Produto Pai ---
    log('🚀 PASSO 2: Ativando o gerenciamento de estoque no produto pai...');
    try {
        await axios.put(`${config.YAMPI_API}/catalog/products/${produtoCriado.id}`, { manage_stock: true, track_inventory: true }, { headers });
        log('✅ PASSO 2 finalizado!');
    } catch (error) {
        log(`❌ ERRO no PASSO 2: ${JSON.stringify(error.response?.data)}`);
        throw new Error("Falha ao ativar o estoque no produto pai.");
    }

    // --- PAUSA ESTRATÉGICA ---
    log('⏸️ Aguardando 5 segundos para a Yampi processar as variações...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Aumentei para 5 segundos por segurança
    log('✅ Pausa finalizada.');
    
    // --- PASSO 3: Buscar o produto novamente para obter os IDs dos SKUs ---
    log('🚀 PASSO 3: Buscando o produto recém-criado para obter os dados completos...');
    let produtoCompleto;
    try {
        const response = await axios.get(`${config.YAMPI_API}/catalog/products/${produtoCriado.id}`, { headers });
        produtoCompleto = response.data.data;
        log(`✅ PASSO 3 finalizado! Dados completos do produto obtidos.`);
    } catch (error) {
        log(`❌ ERRO no PASSO 3: ${JSON.stringify(error.response?.data)}`);
        throw new Error("Falha ao buscar os dados do produto recém-criado.");
    }

    // --- PASSO 4: Adicionar Estoque para Cada SKU ---
    log('🚀 PASSO 4: Adicionando estoque para cada variação...');
    const skusCriados = produtoCompleto.skus || [];
    if (skusCriados.length === 0) {
        log('⚠️ ALERTA: Nenhuma variação (SKU) foi encontrada no produto buscado. O estoque não pode ser adicionado.');
    }
    for (const sku of skusCriados) {
        const variationData = sku.variations && sku.variations[0] ? sku.variations[0] : null;
        if (variationData) {
            const valueId = variationData.value_id;
            const tamanho = Object.keys(YAMPI_VARIATIONS.TAMANHO.values).find(key => YAMPI_VARIATIONS.TAMANHO.values[key] === valueId);
            if (tamanho) {
                const estoqueParaEsteTamanho = dados.estoque[tamanho] || 0;
                try {
                    log(`- Adicionando ${estoqueParaEsteTamanho} unidades para o SKU ${sku.sku}`);
                    await axios.post(`${config.YAMPI_API}/catalog/skus/${sku.id}/stocks`, { quantity: estoqueParaEsteTamanho }, { headers });
                    log(`  ✅ Estoque para ${tamanho} adicionado.`);
                } catch (error) {
                    log(`  ❌ ERRO no PASSO 4 para o SKU ${sku.id}: ${JSON.stringify(error.response?.data)}`);
                }
            }
        }
    }

    log('✅ Processo de criação finalizado!');
    return produtoCompleto;
}

// --- ROTAS DO SERVIDOR ---
// O restante do código permanece o mesmo

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

app.get('/test-create', async (req, res) => {
    try {
        const dadosTeste = {
            nome: `Produto Teste Yampi ${Date.now()}`, preco: 129.90, desconto: 15,
            tamanhos: ['P', 'M', 'G', 'GG'], estoque: { 'P': 2, 'M': 5, 'G': 6, 'GG': 3 },
            descricao: 'Produto de teste completo criado diretamente na Yampi'
        };
        log('🚀 INICIANDO TESTE FINAL (Com Pausa)...');
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

app.get('/', (req, res) => res.send(`<h1>Servidor da Automação Yampi no ar.</h1><p><a href="/test-create">Clique aqui para fazer um teste rápido.</a></p><p><a href="/whatsapp">Clique aqui para ir ao simulador de WhatsApp.</a></p>`));
app.get('/messages', (req, res) => res.json({ messages: simulatedMessages }));
app.get('/whatsapp', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>WhatsApp Simulator</title><style>body{font-family:sans-serif;max-width:450px;margin:20px auto;background:#e5ddd5}#chat{background:#ece5dd;height:400px;overflow-y:auto;padding:10px;border:1px solid #ccc}.msg{margin:10px 0;padding:10px;border-radius:8px;max-width:85%}.sent{background:#dcf8c6;margin-left:auto}.received{background:white}#input{display:flex;padding:10px}textarea{flex:1;padding:10px;border-radius:15px;margin-right:10px}button{background:#075e54;color:white;border:none;border-radius:50%;width:50px;height:50px;cursor:pointer}</style></head><body><div id="chat-container"><div id="chat"></div><div id="input"><textarea id="messageInput" placeholder="Digite sua mensagem..."></textarea><button onclick="sendMessage()">▶</button></div></div><script>const chat=document.getElementById('chat'),input=document.getElementById('messageInput');async function sendMessage(){const msg=input.value.trim();if(!msg)return;addMessage(msg,'sent');input.value='';const webhookData={data:{key:{remoteJid:'test-user@s.whatsapp.net'},message:{conversation:msg}}};await fetch('/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(webhookData)});setTimeout(loadMessages,1500)}function addMessage(text,type){const div=document.createElement('div');div.className='msg '+type;div.innerText=text;chat.appendChild(div);chat.scrollTop=chat.scrollHeight}async function loadMessages(){const res=await fetch('/messages');const data=await res.json();const lastResponse=data.messages.filter(m=>m.type==='resposta').pop();if(lastResponse)addMessage(lastResponse.message,'received')}</script></body></html>`);
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(config.PORT, () => {
    log(`🚀 Servidor DEFINITIVO rodando na porta ${config.PORT}`);
    log(`✅ Automação configurada para comunicação direta com a Yampi.`);
    log(`🔗 Acesse http://localhost:${config.PORT} para a interface (se estiver rodando localmente).`);
});

// --- TRATAMENTO DE ERROS GLOBAIS ---
process.on('uncaughtException', (error) => { log(`❌ Erro não capturado: ${error.stack}`); });
process.on('unhandledRejection', (reason) => { log(`❌ Promise rejeitada: ${reason}`); });
