// servidor.js - VERSÃO DEFINITIVA - Comunicação Direta com a API Yampi
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
    simulatedMessages.push({ timestamp, message: logMessage, type: 'log' });
    if (simulatedMessages.length > 100) {
        simulatedMessages.shift();
    }
}

// Função para obter brand_id válido
async function obterBrandIdValido() {
    try {
        const response = await axios.get(`${config.YAMPI_API}/catalog/brands`, {
            headers: { 'User-Token': config.YAMPI_TOKEN, 'User-Secret-Key': config.YAMPI_SECRET_KEY },
            params: { limit: 1 }
        });
        const brands = response.data.data || [];
        if (brands.length > 0) {
            console.log(`✅ Marca encontrada: ${brands[0].name} (ID: ${brands[0].id})`);
            return brands[0].id;
        }
        return 44725512;
    } catch (error) {
        console.error('⚠ Erro ao obter brand_id:', error.message);
        return 44725512;
    }
}

// ==================================================================================
// FUNÇÃO PRINCIPAL DEFINITIVA - PAYLOAD COMPLETO ENVIADO DIRETAMENTE PARA A YAMPI
// ==================================================================================
async function criarProdutoCompleto(dados) {
    try {
        const brandId = await obterBrandIdValido();

        // Calcular preços
        const precoVenda = parseFloat(dados.preco);
        let precoPromocional = null;
        if (dados.desconto) {
            precoPromocional = precoVenda * (1 - dados.desconto / 100);
        } else if (dados.precoPromocional) {
            precoPromocional = parseFloat(dados.precoPromocional);
        }

        console.log('🚀 Montando payload completo para a Yampi...');

        // 1. CRIE O ARRAY DE COMBINAÇÕES DE VARIANTES
        const variantsCombination = dados.tamanhos.map(tamanho => {
            const skuVariant = `${gerarSKU(dados.nome, 4)}-${tamanho.toUpperCase()}`;
            return {
                values: [tamanho.toUpperCase()],
                sku: skuVariant,
                stock: dados.estoque[tamanho] || 0
            };
        });

        // 2. MONTE O PAYLOAD PRINCIPAL COMPLETO
        const yampiPayload = {
            name: dados.nome,
            description: dados.descricao || `${dados.nome} - Produto de qualidade`,
            sku: gerarSKU(dados.nome, 8),
            brand_id: brandId,
            active: true,
            has_variations: true,
            simple: false,
            price_sale: precoVenda.toString(),
            ...(precoPromocional && { price_discount: precoPromocional.toString() }),
            quantity: 0,
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20,

            // A ESTRUTURA CORRETA QUE APRENDEMOS:
            attributes: ["Tamanho"],
            variants_combination: variantsCombination
        };

        // 3. FAÇA A CHAMADA ÚNICA PARA A API DA YAMPI
        console.log('📦 Enviando produto completo diretamente para a Yampi...');
        
        const endpoint = `${config.YAMPI_API}/catalog/products`;

        const headers = {
            'User-Token': config.YAMPI_TOKEN,
            'User-Secret-Key': config.YAMPI_SECRET_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const response = await axios.post(endpoint, yampiPayload, { headers });

        const produtoCriado = response.data.data;
        console.log('✅ Produto criado com sucesso na Yampi! ID:', produtoCriado.id);

        return produtoCriado;

    } catch (error) {
        const errorData = error.response?.data;
        console.error('❌ ERRO GERAL ao criar produto na Yampi:', JSON.stringify(errorData, null, 2) || error.message);
        throw new Error(errorData?.errors ? JSON.stringify(errorData.errors) : 'Erro na API da Yampi.');
    }
}

// Gerar SKU único
function gerarSKU(nome, length = 6) {
    const timestamp = Date.now().toString().slice(-length);
    const nomeClean = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return `${nomeClean}${timestamp}`;
}

// Extrair dados da mensagem
function extrairDados(message) {
    const dados = {
        nome: '', preco: 0, desconto: null, precoPromocional: null,
        tamanhos: ['Único'], estoque: { 'Único': 10 }, categoria: '', descricao: ''
    };
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

// Webhook para receber mensagens
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        if (data && data.message) {
            const phone = data.key.remoteJid;
            let message = data.message.conversation || data.message.extendedTextMessage?.text || data.message.imageMessage?.caption || '';
            if (!message) { res.status(200).json({ success: true }); return; }
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            if (message.toLowerCase().includes('/cadastrar')) {
                await processarProduto(message, phone);
            } else if (message.toLowerCase().includes('/ajuda')) {
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
        await simularResposta(phone, `⏳ Processando seu produto...`);
        const dados = extrairDados(message);
        if (!dados.nome || !dados.preco) {
            await simularResposta(phone, `⚠ Erro: Nome e Preço são obrigatórios!`);
            return;
        }
        const produto = await criarProdutoCompleto(dados);
        await enviarConfirmacao(phone, produto, dados);
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await simularResposta(phone, `⚠ Erro ao criar o produto: ${error.message}`);
    }
}

// Confirmação de produto criado (Atualizada)
async function enviarConfirmacao(phone, produto, dados) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + (b || 0), 0);
    const confirmacao = `✅ PRODUTO CRIADO COM SUCESSO!\n📦 ${dados.nome}\n\n🎯 STATUS DA CRIAÇÃO:\n• Produto: ✅ Criado Diretamente na Yampi\n• Variações: ✅ ${dados.tamanhos.join(', ')}\n• Estoque Total: ✅ ${totalEstoque} unidades\n\n🔗 Produto ID: ${produto.id}\n🌐 Painel: https://painel.yampi.com.br/catalog/products/${produto.id}\n\n🎉 PRODUTO PRONTO PARA VENDA!`;
    await simularResposta(phone, confirmacao);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 AJUDA - AUTOMAÇÃO YAMPI\n\n🔹 PRODUTO COMPLETO (EXEMPLO):\n/cadastrar\nNome: Camiseta Premium\nPreço: R$ 150,00\nTamanhos: P,M,G,GG\nEstoque: P=3,M=8,G=5,GG=2\n\n✅ Campos obrigatórios: Nome e Preço`;
    await simularResposta(phone, ajuda);
}

// Simular resposta
async function simularResposta(phone, message) {
    const resposta = { timestamp: new Date().toLocaleString('pt-BR'), phone, message, type: 'resposta' };
    simulatedMessages.push(resposta);
    log(`Resposta simulada para ${phone}: ${message.substring(0, 50)}...`);
}

// ENDPOINTS DE TESTE E STATUS
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
            success: true,
            message: '✅ PRODUTO DE TESTE CRIADO DIRETAMENTE NA YAMPI!',
            produto: { id: produto.id, name: produto.name },
            verificar_painel: `https://painel.yampi.com.br/catalog/products/${produto.id}`
        });
    } catch (error) {
        log(`❌ ERRO NO ENDPOINT DE TESTE: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ... (Restante do código para o simulador e servidor, sem alterações) ...
// (Incluiria aqui as rotas '/', '/whatsapp', '/messages', e a inicialização do servidor)

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor DEFINITIVO rodando na porta ${config.PORT}`);
    console.log(`✅ Automação configurada para comunicação direta com a Yampi.`);
});

// Tratamento de erros globais
process.on('uncaughtException', (error) => { console.error('Erro não capturado:', error); });
process.on('unhandledRejection', (reason) => { console.error('Promise rejeitada:', reason); });
