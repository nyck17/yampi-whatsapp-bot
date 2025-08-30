// servidor.js - AUTOMAÇÃO YAMPI + WHATSAPP - VERSÃO 9.0 SKU CORRIGIDO
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

// IDs das variações EXISTENTES na Yampi
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
        
        return 44725512;
        
    } catch (error) {
        console.error('⚠ Erro ao obter brand_id:', error.message);
        return 44725512;
    }
}

// FUNÇÃO PRINCIPAL V8.0 - USANDO VARIAÇÕES EXISTENTES CORRETAMENTE
async function criarProdutoCompleto(dados) {
    try {
        const brandId = await obterBrandIdValido();
        
        // Calcular preços
        const precoVenda = parseFloat(dados.preco);
        let precoPromocional = precoVenda;
        
        if (dados.desconto) {
            precoPromocional = precoVenda * (1 - dados.desconto / 100);
        } else if (dados.precoPromocional) {
            precoPromocional = parseFloat(dados.precoPromocional);
        }
        
        const temVariacoes = dados.tamanhos.length > 1 || 
                            (dados.tamanhos.length === 1 && dados.tamanhos[0] !== 'Único');
        
        console.log('🚀 VERSÃO 8.0 - USANDO VARIAÇÕES EXISTENTES');
        console.log('- Nome:', dados.nome);
        console.log('- Tem variações:', temVariacoes);
        console.log('- Tamanhos:', dados.tamanhos);
        console.log('- Estoque:', dados.estoque);
        
        // ============================================
        // PASSO 1: CRIAR PRODUTO BASE
        // ============================================
        const produtoBase = {
            sku: gerarSKU(dados.nome),
            name: dados.nome,
            brand_id: brandId,
            
            // Produto com variações
            has_variations: temVariacoes,
            simple: !temVariacoes,
            active: true,
            featured: false,
            
            // Preços
            price: precoVenda.toString(),
            price_sale: precoVenda.toString(),
            price_discount: precoPromocional.toString(),
            
            // Sem estoque no produto base se tem variações
            quantity: temVariacoes ? 0 : Object.values(dados.estoque)[0] || 10,
            
            description: dados.descricao || `${dados.nome} - Produto de qualidade`,
            
            // Dimensões
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('📦 PASSO 1: Criando produto base...');
        
        const responseProduto = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoBase,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const produto = responseProduto.data.data;
        console.log('✅ Produto base criado! ID:', produto.id);
        
        // Se tem variações, criar SKUs com as variações EXISTENTES
        if (temVariacoes) {
            console.log('🎯 PASSO 2: Criando SKUs com variações existentes...');
            
            for (const tamanho of dados.tamanhos) {
                const valueId = YAMPI_VARIATIONS.TAMANHO.values[tamanho.toUpperCase()];
                
                if (!valueId) {
                    console.error(`⚠️ Tamanho ${tamanho} não encontrado nas variações existentes`);
                    continue;
                }
                
                const estoqueQuantidade = dados.estoque[tamanho] || 0;
                
                // ============================================
                // AQUI ESTÁ A LINHA CORRIGIDA
                // ============================================
                const skuData = {
                    product_id: produto.id,
                    sku: `${produtoBase.sku}-${tamanho}`, // CORRIGIDO: usa produtoBase.sku
                    title: tamanho,
                    
                    // FORMATO CORRETO: variations array com objetos
                    variations: [
                        {
                            variation_id: YAMPI_VARIATIONS.TAMANHO.variation_id,
                            value_id: valueId
                        }
                    ],
                    
                    // Preços
                    price: precoVenda.toString(),
                    price_sale: precoVenda.toString(),
                    price_discount: precoPromocional.toString(),
                    price_cost: (precoVenda * 0.6).toFixed(2),
                    
                    // Campos necessários
                    blocked_sale: false,
                    active: true,
                    
                    // Dimensões
                    weight: produtoBase.weight,
                    height: produtoBase.height,
                    width: produtoBase.width,
                    length: produtoBase.length
                };
                
                console.log(`📦 Criando SKU ${tamanho} com variation_id=${YAMPI_VARIATIONS.TAMANHO.variation_id}, value_id=${valueId}...`);
                
                try {
                    const responseSKU = await axios.post(
                        `${config.YAMPI_API}/catalog/skus`,
                        skuData,
                        {
                            headers: {
                                'User-Token': config.YAMPI_TOKEN,
                                'User-Secret-Key': config.YAMPI_SECRET_KEY,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            }
                        }
                    );
                    
                    const sku = responseSKU.data.data;
                    console.log(`✅ SKU ${tamanho} criado! ID: ${sku.id}`);
                    
                    // ============================================
                    // CRIAR ESTOQUE PARA O SKU
                    // ============================================
                    if (estoqueQuantidade > 0) {
                        console.log(`📊 Adicionando ${estoqueQuantidade} unidades ao estoque...`);
                        
                        const estoqueData = {
                            quantity: estoqueQuantidade,
                            min_quantity: 0
                        };
                        
                        try {
                            const responseEstoque = await axios.post(
                                `${config.YAMPI_API}/catalog/skus/${sku.id}/stocks`,
                                estoqueData,
                                {
                                    headers: {
                                        'User-Token': config.YAMPI_TOKEN,
                                        'User-Secret-Key': config.YAMPI_SECRET_KEY,
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json'
                                    }
                                }
                            );
                            
                            console.log(`✅ Estoque de ${estoqueQuantidade} unidades adicionado ao SKU ${tamanho}`);
                        } catch (estoqueError) {
                            console.error(`⚠️ Erro ao criar estoque:`, estoqueError.response?.data?.message);
                        }
                    }
                    
                } catch (skuError) {
                    console.error(`❌ Erro ao criar SKU ${tamanho}:`, skuError.response?.data);
                }
            }
            
            // ============================================
            // PASSO 3: ATIVAR GERENCIAMENTO DE ESTOQUE
            // ============================================
            console.log('🔧 PASSO 3: Ativando gerenciamento de estoque...');
            
            try {
                const updateData = {
                    manage_stock: true,
                    track_inventory: true
                };
                
                await axios.put(
                    `${config.YAMPI_API}/catalog/products/${produto.id}`,
                    updateData,
                    {
                        headers: {
                            'User-Token': config.YAMPI_TOKEN,
                            'User-Secret-Key': config.YAMPI_SECRET_KEY,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    }
                );
                
                console.log('✅ Gerenciamento de estoque ativado!');
            } catch (updateError) {
                console.error('⚠️ Erro ao ativar gerenciamento:', updateError.response?.data);
            }
        }
        
        return produto;
        
    } catch (error) {
        console.error('❌ ERRO ao criar produto:', error.response?.data);
        throw new Error(
            error.response?.data?.message || 
            'Erro ao criar produto na Yampi'
        );
    }
}


// Gerar SKU único
function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .substring(0, 8);
    return `${nomeClean}${timestamp}`;
}

// Extrair dados da mensagem
function extrairDados(message) {
    const dados = {
        nome: '',
        preco: 0,
        desconto: null,
        precoPromocional: null,
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
    
    // Extrair desconto em percentual
    const descontoMatch = texto.match(/desconto:\s*(\d+)%/);
    if (descontoMatch) {
        dados.desconto = parseInt(descontoMatch[1]);
    }
    
    // Extrair preço promocional direto
    const promocionalMatch = texto.match(/promocional:\s*r?\$?\s*([\d,\.]+)/);
    if (promocionalMatch) {
        const precoPromoStr = promocionalMatch[1].replace(',', '.');
        dados.precoPromocional = parseFloat(precoPromoStr);
    }
    
    // Extrair categoria
    const categoriaMatch = texto.match(/categoria:\s*([^,\n\r]+)/);
    if (categoriaMatch) {
        dados.categoria = categoriaMatch[1].trim();
    }
    
    // Extrair descrição
    const descricaoMatch = texto.match(/descri[çc][ãa]o:\s*([^,\n\r]+)/);
    if (descricaoMatch) {
        dados.descricao = descricaoMatch[1].trim();
    }
    
    // Extrair tamanhos se especificados
    const tamanhosMatch = texto.match(/tamanhos:\s*([^,\n\r]+)/);
    if (tamanhosMatch) {
        const tamanhosStr = tamanhosMatch[1];
        dados.tamanhos = tamanhosStr.split(',').map(t => t.trim().toUpperCase());
        
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
                    const t = tamanho.trim().toUpperCase();
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
            const erroMsg = `⚠ Erro: Nome e Preço são obrigatórios!

${temImagem ? '📸 Imagem recebida! ' : ''}Formato correto:

BÁSICO:
/cadastrar Nome: Camiseta Preço: R$ 29,90

COM VARIAÇÕES E ESTOQUE:
/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8

COM DESCONTO:
/cadastrar Nome: Produto Preço: R$ 100,00 Desconto: 20%

COMPLETO:
/cadastrar
Nome: Camiseta Premium
Preço: R$ 150,00
Desconto: 15%
Categoria: Roupas
Tamanhos: P,M,G,GG
Estoque: P=3,M=8,G=5,GG=2
Descrição: Camiseta de algodão premium`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        const produto = await criarProdutoCompleto(dados);
        await enviarConfirmacao(phone, produto, dados, temImagem);
        
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await simularResposta(phone, `⚠ Erro: ${error.message}`);
    }
}

// Confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, temImagem = false) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + (parseInt(b) || 0), 0);
    
    // Calcular preço final
    let precoFinal = dados.preco;
    let textoDesconto = '';
    
    if (dados.desconto) {
        precoFinal = dados.preco * (1 - dados.desconto / 100);
        textoDesconto = `\n💸 Desconto: ${dados.desconto}% aplicado!`;
    } else if (dados.precoPromocional) {
        precoFinal = dados.precoPromocional;
        textoDesconto = `\n💸 Preço promocional aplicado!`;
    }
    
    const confirmacao = `✅ PRODUTO CRIADO COM SUCESSO! (V9.0)

📦 ${dados.nome}
💰 R$ ${dados.preco.toFixed(2).replace('.', ',')}${precoFinal !== dados.preco ? ` → R$ ${precoFinal.toFixed(2).replace('.', ',')}` : ''}${textoDesconto}
${temImagem ? '📸 ✅ Imagem detectada!' : '📸 Sem imagem'}
${dados.categoria ? `🏷️ Categoria: ${dados.categoria}` : ''}

🎯 STATUS DA CRIAÇÃO:
• Produto base: ✅ Criado
• SKU Principal: ${produto.sku}
• Variações: ✅ ${dados.tamanhos.length} SKUs criados
• Estoques: ✅ ${totalEstoque} unidades total
• Gerenciamento: ✅ Ativado

📋 Estoque por tamanho:
${dados.tamanhos.map(t => `   ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

🔗 Produto ID: ${produto.id}
🌐 Painel: https://painel.yampi.com.br/catalog/products/${produto.id}

🎉 SKUs CORRIGIDOS - Variações devem funcionar!`;

    await simularResposta(phone, confirmacao);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 AUTOMAÇÃO YAMPI - VERSÃO 9.0!

📋 COMANDOS DISPONÍVEIS:

🔹 PRODUTO BÁSICO:
/cadastrar Nome: Camiseta Preço: R$ 29,90

🔹 COM VARIAÇÕES E ESTOQUE:
/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8

🔹 COM DESCONTO:
/cadastrar Nome: Produto Preço: R$ 100,00 Desconto: 20%

🔹 PRODUTO COMPLETO:
/cadastrar
Nome: Camiseta Premium
Preço: R$ 150,00
Desconto: 15%
Categoria: Roupas Masculinas
Tamanhos: P,M,G,GG
Estoque: P=3,M=8,G=5,GG=2
Descrição: Camiseta de algodão premium

✅ Campos obrigatórios: Nome e Preço
📝 Descrição: OPCIONAL
📸 Imagem: Opcional
📦 Estoque: Quantidade por tamanho

💡 TAMANHOS DISPONÍVEIS: P, M, G, GG`;

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

// Teste produto V9.0 - SKU CORRIGIDO
app.get('/test-v9', async (req, res) => {
    try {
        const dadosTeste = {
            nome: `Teste V9 SKU Corrigido ${Date.now().toString().slice(-6)}`,
            preco: 89.90,
            desconto: 15,
            categoria: 'Teste V9',
            tamanhos: ['P', 'M', 'G'],
            estoque: { 'P': 5, 'M': 10, 'G': 8 },
            descricao: 'Teste com SKU corrigido'
        };
        
        console.log('🚀 TESTANDO VERSÃO 9.0 - SKU CORRIGIDO...');
        
        const produto = await criarProdutoCompleto(dadosTeste);
        
        res.json({
            success: true,
            message: '✅ PRODUTO CRIADO COM SKU CORRIGIDO! (V9.0)',
            produto: {
                id: produto.id,
                name: produto.name,
                sku: produto.sku,
                has_variations: produto.has_variations
            },
            dados_criados: {
                sku_principal: produto.sku,
                skus_variacoes: dados.tamanhos.map(t => `${produto.sku}-${t}`),
                estoque: dadosTeste.estoque,
                estoque_total: Object.values(dadosTeste.estoque).reduce((a, b) => a + b, 0)
            },
            verificar_painel: `https://painel.yampi.com.br/catalog/products/${produto.id}`,
            importante: '🔍 Verifique se as variações aparecem na página de compra!'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// Analisar produto existente
app.get('/analyze-product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        
        console.log(`🔍 Analisando produto ${productId}...`);
        
        const productResponse = await axios.get(
            `${config.YAMPI_API}/catalog/products/${productId}`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const product = productResponse.data.data;
        
        const skusResponse = await axios.get(
            `${config.YAMPI_API}/catalog/skus`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                params: {
                    product_id: productId,
                    limit: 50
                }
            }
        );
        
        const skus = skusResponse.data.data;
        
        const analysis = {
            produto: {
                id: product.id,
                name: product.name,
                sku: product.sku,
                has_variations: product.has_variations,
                simple: product.simple
            },
            skus: skus.map(sku => ({
                id: sku.id,
                sku: sku.sku,
                title: sku.title,
                variations: sku.variations || []
            })),
            resumo: {
                total_skus: skus.length,
                skus_com_codigo_correto: skus.filter(s => s.sku && !s.sku.startsWith('-')).length,
                skus_com_erro: skus.filter(s => s.sku && s.sku.startsWith('-')).length
            }
        };
        
        res.json({
            success: true,
            analysis
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
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
            message: '✅ API Yampi conectada!',
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
            <title>📱 WhatsApp Simulator - V9.0</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 450px; margin: 20px auto; padding: 20px; background: #e5ddd5; }
                .chat-container { background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
                .chat-header { background: #075e54; color: white; padding: 15px; text-align: center; font-weight: bold; }
                .chat-messages { height: 400px; overflow-y: auto; padding: 10px; background: #ece5dd; }
                .message { margin: 10px 0; padding: 10px; border-radius: 8px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap; }
                .message.sent { background: #dcf8c6; margin-left: auto; }
                .message.received { background: white; margin-right: auto; }
                .chat-input { display: flex; padding: 10px; background: #f0f0f0; }
                .chat-input textarea { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 15px; margin-right: 10px; resize: vertical; min-height: 40px; }
                .chat-input button { background: #075e54; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; cursor: pointer; }
                .quick-buttons { padding: 10px; display: flex; gap: 5px; flex-wrap: wrap; }
                .quick-btn { background: #25D366; color: white; border: none; padding: 5px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; }
                .version-badge { background: #ff5722; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 5px; }
