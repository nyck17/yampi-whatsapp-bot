// servidor.js - VERSÃO FINAL 5.0 - Loop de Verificação Ativa para SKUs
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // PASSO 1: Criar o Produto
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
        weight: 0.5, height: 10, width: 15, length: 20, skus: skusPayload
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
    
    // PASSO 2: Ativar Estoque no Pai
    log('🚀 PASSO 2: Ativando o gerenciamento de estoque no produto pai...');
    try {
        await axios.put(`${config.YAMPI_API}/catalog/products/${produtoCriado.id}`, { manage_stock: true, track_inventory: true }, { headers });
        log('✅ PASSO 2 finalizado!');
    } catch (error) {
        log(`❌ ERRO no PASSO 2: ${JSON.stringify(error.response?.data)}`);
        throw new Error("Falha ao ativar o estoque no produto pai.");
    }
    
    // PASSO 3 (NOVO): Loop de Verificação Ativa
    log('🚀 PASSO 3: Iniciando verificação ativa das variações...');
    let produtoCompleto;
    let tentativas = 0;
    const maxTentativas = 6; // Tenta por 30 segundos (6 * 5s)
    
    while (tentativas < maxTentativas) {
        tentativas++;
        log(`- Tentativa ${tentativas}/${maxTentativas}: Buscando dados do produto...`);
        const response = await axios.get(`${config.YAMPI_API}/catalog/products/${produtoCriado.id}`, { headers });
        const produtoBuscado = response.data.data;
        
        if (produtoBuscado.skus && produtoBuscado.skus.length > 0) {
            log(`✅ Variações encontradas na tentativa ${tentativas}!`);
            produtoCompleto = produtoBuscado;
            break; // Sai do loop
        }
        
        if (tentativas < maxTentativas) {
            log(`- Variações ainda não processadas. Aguardando 5 segundos...`);
            await sleep(5000);
        }
    }

    if (!produtoCompleto) {
        log('❌ ERRO no PASSO 3: As variações não foram encontradas no produto após 30 segundos.');
        throw new Error("Timeout: Variações não processadas pela Yampi a tempo.");
    }

    // PASSO 4: Adicionar Estoque
    log('🚀 PASSO 4: Adicionando estoque para cada variação...');
    for (const sku of produtoCompleto.skus) {
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
// (O restante do código não precisa de alterações)
// ...
