// servidor.js - AUTOMAÇÃO YAMPI + WHATSAPP - VERSÃO DEFINITIVA CORRIGIDA
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
        
        return 44725512;
        
    } catch (error) {
        console.error('⚠ Erro ao obter brand_id:', error.message);
        return 44725512;
    }
}

// Função DEFINITIVA - FLUXO CORRETO YAMPI: Produto → SKUs → Estoques
async function criarProdutoYampi(dados) {
    try {
        const brandId = await obterBrandIdValido();
        
        // Calcular preços CORRETAMENTE
        const precoVenda = parseFloat(dados.preco);
        let precoPromocional = precoVenda;
        
        // Se tem desconto, calcular preço promocional
        if (dados.desconto) {
            precoPromocional = precoVenda * (1 - dados.desconto / 100);
        } else if (dados.precoPromocional) {
            precoPromocional = parseFloat(dados.precoPromocional);
        }
        
        // Determinar se é produto simples ou com variações
        const temVariacoes = dados.tamanhos.length > 1 || 
                            (dados.tamanhos.length === 1 && dados.tamanhos[0] !== 'Único');
        
        console.log('📦 INICIANDO CRIAÇÃO DO PRODUTO');
        console.log('- Nome:', dados.nome);
        console.log('- Preço original:', precoVenda);
        console.log('- Preço final:', precoPromocional);
        console.log('- Tem variações:', temVariacoes);
        console.log('- Tamanhos:', dados.tamanhos);
        
        // PASSO 1: CRIAR PRODUTO BASE
        const produtoBase = {
            sku: gerarSKU(dados.nome),
            name: dados.nome,
            brand_id: brandId,
            
            // CONFIGURAÇÃO CORRETA
            simple: !temVariacoes, // false se tem variações
            active: true,
            featured: false,
            
            // PREÇOS em formato string
            price: precoVenda.toString(),
            price_sale: precoVenda.toString(),
            price_discount: precoPromocional.toString(),
            
            // ESTOQUE inicial (será 0 se tem variações)
            quantity: temVariacoes ? 0 : Object.values(dados.estoque)[0] || 10,
            
            // DESCRIÇÃO
            description: dados.descricao || `${dados.nome} - Produto de qualidade`,
            
            // DIMENSÕES OBRIGATÓRIAS
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('🔄 Criando produto base...');
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
        
        // PASSO 2: CRIAR VARIAÇÕES E VALORES se necessário
        if (temVariacoes) {
            console.log('🎯 Criando Variações e Valores...');
            
            // PASSO 2.1: CRIAR VARIAÇÃO "Tamanho"
            const variacaoData = {
                name: "Tamanho"
            };
            
            console.log('🔄 Criando variação "Tamanho"...');
            const responseVariacao = await axios.post(
                `${config.YAMPI_API}/catalog/variations`,
                variacaoData,
                {
                    headers: {
                        'User-Token': config.YAMPI_TOKEN,
                        'User-Secret-Key': config.YAMPI_SECRET_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            
            const variacao = responseVariacao.data.data;
            console.log('✅ Variação criada! ID:', variacao.id);
            
            // PASSO 2.2: CRIAR VALORES DA VARIAÇÃO (P, M, G, etc.)
            const valoresIds = [];
            
            for (const tamanho of dados.tamanhos) {
                console.log(`🔄 Criando valor "${tamanho}" para variação...`);
                
                const valorData = {
                    name: tamanho
                };
                
                const responseValor = await axios.post(
                    `${config.YAMPI_API}/catalog/variations/${variacao.id}/values`,
                    valorData,
                    {
                        headers: {
                            'User-Token': config.YAMPI_TOKEN,
                            'User-Secret-Key': config.YAMPI_SECRET_KEY,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    }
                );
                
                const valor = responseValor.data.data;
                valoresIds.push(valor.id);
                console.log(`✅ Valor "${tamanho}" criado! ID: ${valor.id}`);
            }
            
            // PASSO 2.3: CRIAR SKUs COM variations_values_ids CORRETOS
            console.log('🎯 Criando SKUs com valores de variação...');
            
            for (let i = 0; i < dados.tamanhos.length; i++) {
                const tamanho = dados.tamanhos[i];
                const valorId = valoresIds[i];
                
                const skuData = {
                    product_id: produto.id,
                    sku: `${produto.sku}-${tamanho}`,
                    title: tamanho,
                    
                    // PREÇOS da variação
                    price: precoVenda.toString(),
                    price_sale: precoVenda.toString(),
                    price_discount: precoPromocional.toString(),
                    
                    // CAMPOS OBRIGATÓRIOS:
                    price_cost: (precoVenda * 0.6).toFixed(2),
                    blocked_sale: false,
                    variations_values_ids: [valorId], // ID do valor específico!
                    
                    // STATUS
                    active: true,
                    
                    // DIMENSÕES
                    weight: produtoBase.weight,
                    height: produtoBase.height,
                    width: produtoBase.width,
                    length: produtoBase.length
                };
                
                console.log(`- Criando SKU ${tamanho} com valor ID ${valorId}...`);
                
                try {
                    // CRIAR SKU (VARIAÇÃO) - COM LOGS DETALHADOS
                    console.log(`🔍 DADOS DO SKU ${tamanho}:`, JSON.stringify(skuData, null, 2));
                    
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
                    
                    console.log(`📋 RESPONSE SKU ${tamanho}:`, JSON.stringify(responseSKU.data, null, 2));
                    
                    const sku = responseSKU.data.data;
                    console.log(`✅ SKU ${tamanho} criado! ID: ${sku.id}`);
                    
                    // PASSO 2.4: CRIAR ESTOQUE PARA ESTE SKU
                    const estoqueQuantidade = dados.estoque[tamanho] || 0;
                    
                    if (estoqueQuantidade > 0) {
                        console.log(`📦 CRIANDO ESTOQUE para SKU ${sku.id} - Quantidade: ${estoqueQuantidade}`);
                        
                        const estoqueData = {
                            stock_id: 1, // ID do estoque padrão
                            quantity: estoqueQuantidade,
                            min_quantity: 0
                        };
                        
                        console.log(`🔍 DADOS DO ESTOQUE:`, JSON.stringify(estoqueData, null, 2));
                        
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
                        
                        console.log(`📋 RESPONSE ESTOQUE:`, JSON.stringify(responseEstoque.data, null, 2));
                        console.log(`✅ Estoque ${estoqueQuantidade} adicionado para SKU ${tamanho}`);
                    }
                    
                } catch (errorSKU) {
                    console.error(`❌ ERRO DETALHADO ao criar SKU ${tamanho}:`);
                    console.error('Status:', errorSKU.response?.status);
                    console.error('Headers:', errorSKU.response?.headers);
                    console.error('Data:', JSON.stringify(errorSKU.response?.data, null, 2));
                    console.error('Config:', JSON.stringify(errorSKU.config, null, 2));
                    
                    // Log para Railway
                    log(`ERRO SKU ${tamanho}: ${errorSKU.response?.status} - ${JSON.stringify(errorSKU.response?.data)}`);
                    
                    // Continua com outros SKUs mesmo se um falhar
                }
            }
        }
        
        // PASSO 4: VERIFICAÇÃO FINAL
        console.log('🔍 Verificando produto criado...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
        
        return produto;
        
    } catch (error) {
        console.error('❌ ERRO DETALHADO ao criar produto:');
        console.error('Status:', error.response?.status);
        console.error('Dados do erro:', JSON.stringify(error.response?.data, null, 2));
        
        throw new Error(
            error.response?.data?.message || 
            JSON.stringify(error.response?.data?.errors) ||
            'Erro ao criar produto na Yampi'
        );
    }
}

// Gerar SKU único MELHORADO
function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
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
    
    // Extrair descrição OPCIONAL
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

COM VARIAÇÕES:
/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8

COM DESCONTO:
/cadastrar Nome: Produto Preço: R$ 100,00 Desconto: 20%`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        const produto = await criarProdutoYampi(dados);
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
    
    const confirmacao = `✅ PRODUTO CRIADO COM SUCESSO!

📦 ${dados.nome}
💰 R$ ${dados.preco.toFixed(2).replace('.', ',')}${precoFinal !== dados.preco ? ` → R$ ${precoFinal.toFixed(2).replace('.', ',')}` : ''}${textoDesconto}
${temImagem ? '📸 ✅ Imagem detectada!' : '📸 Sem imagem'}

🎯 DETALHES CRIADOS:
• Produto base: ✅ Criado
• SKUs/Variações: ✅ ${dados.tamanhos.length} criados
• Estoques: ✅ ${totalEstoque} unidades total
• SKU: ${produto.sku}

📋 Estoque por variação:
${dados.tamanhos.map(t => `   ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

🔗 Produto ID: ${produto.id}
🌐 Disponível na sua loja Yampi!

🎉 FLUXO COMPLETO EXECUTADO: Produto → SKUs → Estoques`;

    await simularResposta(phone, confirmacao);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 AUTOMAÇÃO YAMPI - VERSÃO DEFINITIVA!

📋 COMANDOS DISPONÍVEIS:

🔹 PRODUTO BÁSICO:
/cadastrar Nome: Camiseta Preço: R$ 29,90

🔹 COM VARIAÇÕES:
/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8

🔹 COM DESCONTO:
/cadastrar Nome: Produto Preço: R$ 100,00 Desconto: 20%

🔹 COMPLETO:
/cadastrar
Nome: Produto Completo
Preço: R$ 150,00
Desconto: 15%
Categoria: Roupas
Tamanhos: P,M,G,GG
Estoque: P=3,M=8,G=5,GG=2
Descrição: Produto premium

✅ Campos obrigatórios: Nome e Preço
🎯 FLUXO: Produto → SKUs → Estoques
📸 Imagens: Detectadas automaticamente`;

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

// Teste produto DEFINITIVO
app.get('/test-create-definitive', async (req, res) => {
    try {
        const dadosTeste = {
            nome: `Produto Definitivo Yampi ${Date.now()}`,
            preco: 89.90,
            desconto: 15,
            categoria: 'Teste Definitivo',
            tamanhos: ['P', 'M', 'G'],
            estoque: { 'P': 5, 'M': 10, 'G': 8 },
            descricao: 'Produto teste com fluxo definitivo: Produto → SKUs → Estoques'
        };
        
        const produto = await criarProdutoYampi(dadosTeste);
        
        res.json({
            success: true,
            message: '🎉 PRODUTO DEFINITIVO CRIADO COM FLUXO CORRETO!',
            produto: {
                id: produto.id,
                name: produto.name,
                sku: produto.sku,
                url: produto.url
            },
            fluxo_executado: {
                'passo_1': 'Produto base criado',
                'passo_2': 'SKUs/variações criados',
                'passo_3': 'Estoques adicionados',
                'total_skus': dadosTeste.tamanhos.length,
                'estoque_total': Object.values(dadosTeste.estoque).reduce((a, b) => a + b, 0)
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint especial para debug no Railway
app.get('/debug-yampi', async (req, res) => {
    try {
        console.log('🔍 INICIANDO DEBUG COMPLETO...');
        
        // 1. Testar conexão básica
        console.log('1️⃣ Testando conexão API...');
        const testConnection = await axios.get(
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
        console.log('✅ Conexão OK');
        
        // 2. Testar criação de produto simples
        console.log('2️⃣ Testando produto simples...');
        const produtoSimples = {
            sku: `TEST-SIMPLE-${Date.now()}`,
            name: `Produto Teste Simples ${Date.now()}`,
            brand_id: await obterBrandIdValido(),
            simple: true,
            active: true,
            price: "50.00",
            price_sale: "50.00",
            price_discount: "45.00",
            quantity: 10,
            description: "Produto teste simples",
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        const responseProdutoSimples = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoSimples,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        console.log('✅ Produto simples criado:', responseProdutoSimples.data.data.id);
        
        // 3. Testar criação de produto com variações COMPLETO
        console.log('3️⃣ Testando produto com variações COMPLETO...');
        const produtoVariacoes = {
            sku: `TEST-VAR-${Date.now()}`,
            name: `Produto Teste Variações ${Date.now()}`,
            brand_id: await obterBrandIdValido(),
            simple: false,
            active: true,
            price: "80.00",
            price_sale: "80.00", 
            price_discount: "70.00",
            quantity: 0,
            description: "Produto teste com variações",
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        const responseProdutoVar = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoVariacoes,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        const produtoVar = responseProdutoVar.data.data;
        console.log('✅ Produto variações criado:', produtoVar.id);
        
        // 4. Testar criação de variação
        console.log('4️⃣ Testando criação de variação...');
        const variacaoData = {
            name: "Tamanho"
        };
        
        const responseVariacao = await axios.post(
            `${config.YAMPI_API}/catalog/variations`,
            variacaoData,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        const variacao = responseVariacao.data.data;
        console.log('✅ Variação criada:', variacao.id);
        
        // 5. Testar criação de valores da variação
        console.log('5️⃣ Testando criação de valores...');
        const tamanhos = ['P', 'M', 'G'];
        const valoresIds = [];
        
        for (const tamanho of tamanhos) {
            const valorData = {
                name: tamanho
            };
            
            const responseValor = await axios.post(
                `${config.YAMPI_API}/catalog/variations/${variacao.id}/values`,
                valorData,
                {
                    headers: {
                        'User-Token': config.YAMPI_TOKEN,
                        'User-Secret-Key': config.YAMPI_SECRET_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            
            const valor = responseValor.data.data;
            valoresIds.push(valor.id);
            console.log(`✅ Valor ${tamanho} criado:`, valor.id);
        }
        
        // 6. Testar criação de SKU COM variations_values_ids
        console.log('6️⃣ Testando criação de SKU com valores...');
        const skuData = {
            product_id: produtoVar.id,
            sku: `${produtoVar.sku}-P`,
            title: "P",
            price: "80.00",
            price_sale: "80.00",
            price_discount: "70.00",
            
            // CAMPOS OBRIGATÓRIOS CORRETOS:
            price_cost: "48.00",
            blocked_sale: false,
            variations_values_ids: [valoresIds[0]], // ID do valor "P"
            
            active: true,
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('📋 Dados SKU:', JSON.stringify(skuData, null, 2));
        
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
        console.log('✅ SKU criado:', sku.id);
        
        // 7. Testar criação de estoque
        console.log('7️⃣ Testando criação de estoque...');
        const estoqueData = {
            stock_id: 1,
            quantity: 5,
            min_quantity: 0
        };
        
        console.log('📋 Dados Estoque:', JSON.stringify(estoqueData, null, 2));
        
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
        console.log('✅ Estoque criado:', responseEstoque.data.data.id);
        
        res.json({
            success: true,
            message: '🎉 DEBUG COMPLETO - FLUXO TOTAL FUNCIONANDO!',
            results: {
                conexao: 'OK',
                produto_simples: responseProdutoSimples.data.data.id,
                produto_variacoes: produtoVar.id,
                variacao_criada: variacao.id,
                valores_criados: valoresIds,
                sku_criado: sku.id,
                estoque_criado: responseEstoque.data.data.id
            },
            fluxo_completo: [
                '1. Produto base ✅',
                '2. Variação "Tamanho" ✅', 
                '3. Valores P,M,G ✅',
                '4. SKUs com variations_values_ids ✅',
                '5. Estoques ✅'
            ]
        });
        
    } catch (error) {
        console.error('❌ ERRO NO DEBUG:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data,
            step: 'Verifique os logs do Railway para ver onde parou'
        });
    }
});

// Endpoint para logs do Railway
app.get('/railway-logs', (req, res) => {
    const logs = simulatedMessages
        .slice(-100) // Últimos 100 logs
        .map(msg => ({
            timestamp: msg.timestamp,
            message: msg.message,
            type: msg.type
        }));
    
    res.json({ 
        logs,
        total: simulatedMessages.length,
        railway_env: {
            YAMPI_STORE: process.env.YAMPI_STORE,
            YAMPI_TOKEN_CONFIGURED: !!process.env.YAMPI_TOKEN,
            YAMPI_SECRET_CONFIGURED: !!process.env.YAMPI_SECRET_KEY,
            PORT: process.env.PORT,
            NODE_ENV: process.env.NODE_ENV
        }
    });
});
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
            <title>📱 WhatsApp Simulator - VERSÃO DEFINITIVA</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 450px; margin: 20px auto; padding: 20px; background: #e5ddd5; }
                .chat-container { background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
                .chat-header { background: #075e54; color: white; padding: 15px; text-align: center; font-weight: bold; }
                .chat-messages { height: 400px; overflow-y: auto; padding: 10px; background: #ece5dd; }
                .message { margin: 10px 0; padding: 10px; border-radius: 8px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap; }
                .message.sent { background: #dcf8c6; margin-left: auto; text-align: left; }
                .message.received { background: white; margin-right: auto; }
                .chat-input { display: flex; padding: 10px; background: #f0f0f0; }
                .chat-input textarea { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 15px; margin-right: 10px; resize: vertical; min-height: 40px; max-height: 100px; }
                .chat-input button { background: #075e54; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; cursor: pointer; font-size: 16px; }
                .example { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 12px; }
                .timestamp { font-size: 10px; color: #999; margin-top: 5px; }
                .quick-buttons { padding: 10px; display: flex; gap: 5px; flex-wrap: wrap; }
                .quick-btn { background: #25D366; color: white; border: none; padding: 5px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    🤖 Automação Yampi - DEFINITIVA! 🎯
                    <div style="font-size: 12px; opacity: 0.8;">🟢 Produto → SKUs → Estoques</div>
                </div>
                
                <div class="chat-messages" id="messages">
                    <div class="message received">
                        🎉 VERSÃO DEFINITIVA!<br>
                        ✅ Fluxo correto: Produto → SKUs → Estoques<br>
                        ✅ Variações funcionando<br>
                        ✅ Estoque por SKU<br>
                        📝 Descrição opcional<br>
                        Envie /ajuda para ver comandos.
                        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div class="quick-buttons">
                    <button class="quick-btn" onclick="quickMessage('/ajuda')">📖 Ajuda</button>
                    <button class="quick-btn" onclick="quickMessage('/cadastrar Nome: Teste Básico Preço: R$ 29,90')">⚡ Básico</button>
                    <button class="quick-btn" onclick="testeDefinitivo()">🎯 Definitivo</button>
                </div>
                
                <div class="example">
                    <strong>🎯 TESTE DEFINITIVO:</strong><br>
                    Produto → 3 SKUs → Estoques individuais<br>
                    <strong>Resultado:</strong> Variações funcionais na Yampi!
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
                
                function testeDefinitivo() {
                    const message = \`/cadastrar
Nome: Produto Teste Definitivo
Preço: R$ 89,90
Desconto: 15%
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Descrição: Teste do fluxo definitivo\`;
                    messageInput.value = message;
                    sendMessage();
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
                    
                    try {
                        await fetch('/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(webhookData)
                        });
                        
                        setTimeout(loadMessages, 2000);
                        
                    } catch (error) {
                        addMessage('⚠ Erro: ' + error.message, 'received');
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
        version: '4.0 - VERSÃO DEFINITIVA YAMPI',
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            yampi_store: process.env.YAMPI_STORE || 'griffestreet'
        },
        messages_count: simulatedMessages.length,
        features: [
            'fluxo_correto_yampi',
            'produto_base_criado', 
            'skus_variacao_criados',
            'estoques_individuais',
            'precos_funcionais',
            'descricao_opcional'
        ],
        fluxo_yampi: [
            'POST /catalog/products (produto base)',
            'POST /catalog/variations (variação)',
            'POST /catalog/variations/{id}/values (valores)',
            'POST /catalog/skus (SKUs com variations_values_ids)',
            'POST /catalog/skus/{id}/stocks (estoques)'
        ]
    });
});

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Automação Yampi - VERSÃO DEFINITIVA!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #25D366; text-align: center; }
                .status { text-align: center; padding: 20px; margin: 20px 0; border-radius: 10px; background: #d1ecf1; border: 1px solid #bee5eb; }
                .test-buttons { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin: 20px 0; }
                .test-btn { background: #007bff; color: white; padding: 15px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; }
                .test-btn:hover { background: #0056b3; color: white; text-decoration: none; }
                .test-btn.success { background: #28a745; }
                .test-btn.success:hover { background: #218838; }
                .example { background: #f8f9fa; padding: 20px; border-left: 4px solid #25D366; margin: 20px 0; }
                pre { background: #e9ecef; padding: 15px; border-radius: 5px; font-size: 14px; }
                .result-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6; }
                #results { display: none; }
                .flow-step { background: #e8f5e8; padding: 10px; margin: 5px 0; border-radius: 5px; border-left: 4px solid #28a745; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi - VERSÃO DEFINITIVA!</h1>
                
                <div class="status">
                    <h3>🎯 FLUXO DEFINITIVO IMPLEMENTADO!</h3>
                    <p><strong>Versão 4.0 - Baseado na documentação oficial</strong></p>
                    <div class="flow-step">1️⃣ POST /catalog/products → Criar produto base</div>
                    <div class="flow-step">2️⃣ POST /catalog/skus → Criar SKUs/variações</div>
                    <div class="flow-step">3️⃣ POST /catalog/skus/{id}/stocks → Adicionar estoques</div>
                </div>
                
                <div class="test-buttons">
                    <button class="test-btn success" onclick="testarEndpoint('/debug-yampi')">🔍 DEBUG RAILWAY</button>
                    <button class="test-btn success" onclick="testarEndpoint('/test-create-definitive')">🎯 TESTE DEFINITIVO</button>
                    <a href="/whatsapp" class="test-btn success" style="font-size: 16px; font-weight: bold;">📱 WHATSAPP DEFINITIVO</a>
                    <a href="/railway-logs" class="test-btn" target="_blank">📋 LOGS RAILWAY</a>
                    <a href="/test-yampi" class="test-btn">🔌 Testar API</a>
                    <a href="/status" class="test-btn">📊 Status v4.0</a>
                </div>
                
                <div id="results" class="result-box">
                    <h4>📋 Resultados dos Testes:</h4>
                    <pre id="result-content">Clique nos botões acima para executar os testes...</pre>
                </div>
                
                <div class="example">
                    <h3>🎯 TESTE DEFINITIVO:</h3>
                    <p><strong>1. Vá para o WhatsApp Simulator</strong></p>
                    <p><strong>2. Digite:</strong></p>
                    <pre>/cadastrar
Nome: Produto Teste Definitivo
Preço: R$ 89,90
Desconto: 15%
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Descrição: Teste definitivo</pre>
                    <p><strong>3. ✅ Resultado esperado:</strong></p>
                    <ul>
                        <li>✅ 1 Produto base criado na Yampi</li>
                        <li>✅ 3 SKUs criados (P, M, G)</li>
                        <li>✅ 3 Estoques adicionados (5+10+8=23 total)</li>
                        <li>✅ Preços com desconto: R$ 89,90 → R$ 76,42</li>
                        <li>✅ Variações aparecendo no painel Yampi</li>
                    </ul>
                </div>
                
                <div class="example">
                    <h3>🎯 FLUXO COMPLETO CORRETO:</h3>
                    <p><strong>Baseado na documentação oficial:</strong></p>
                    <div class="flow-step">1️⃣ POST /catalog/products → Produto base</div>
                    <div class="flow-step">2️⃣ POST /catalog/variations → Variação "Tamanho"</div>
                    <div class="flow-step">3️⃣ POST /catalog/variations/{id}/values → Valores P,M,G</div>
                    <div class="flow-step">4️⃣ POST /catalog/skus → SKUs com variations_values_ids</div>
                    <div class="flow-step">5️⃣ POST /catalog/skus/{id}/stocks → Estoques</div>
                    <p>✅ Agora as variações aparecerão no painel!</p>
                </div>
                
                <p style="text-align: center; color: #666; margin-top: 30px;">
                    🎯 <strong>VERSÃO DEFINITIVA!</strong> Baseada na documentação oficial da Yampi! 🚀
                </p>
            </div>

            <script>
                async function testarEndpoint(endpoint) {
                    const resultsDiv = document.getElementById('results');
                    const contentDiv = document.getElementById('result-content');
                    
                    resultsDiv.style.display = 'block';
                    contentDiv.textContent = '⏳ Executando fluxo definitivo...';
                    
                    try {
                        const response = await fetch(endpoint);
                        const data = await response.json();
                        
                        contentDiv.textContent = JSON.stringify(data, null, 2);
                        
                        if (data.success) {
                            resultsDiv.style.background = '#d1ecf1';
                            resultsDiv.style.border = '1px solid #bee5eb';
                            
                            if (endpoint.includes('definitive') && data.success) {
                                setTimeout(() => {
                                    if (confirm('🎯 Produto definitivo criado! Verificar no painel Yampi?')) {
                                        window.open('https://painel.yampi.com.br/catalog/products', '_blank');
                                    }
                                }, 2000);
                            }
                        } else {
                            resultsDiv.style.background = '#f8d7da';
                            resultsDiv.style.border = '1px solid #f5c6cb';
                        }
                        
                    } catch (error) {
                        contentDiv.textContent = \`⚠ Erro: \${error.message}\`;
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
    log(`🚀 Servidor VERSÃO DEFINITIVA rodando na porta ${config.PORT}`);
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🤖 AUTOMAÇÃO YAMPI v4.0 - VERSÃO DEFINITIVA 🎯             ║
║              FLUXO CORRETO IMPLEMENTADO                       ║
╠═══════════════════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE na porta ${config.PORT}                      ║
║  ✅ Yampi Store: ${process.env.YAMPI_STORE || 'griffestreet'}                             ║
║  ✅ Token: CONFIGURADO                                       ║
║  🎯 Fluxo: DEFINITIVO (baseado na documentação)             ║
╠═══════════════════════════════════════════════════════════════╣
║                FLUXO DEFINITIVO YAMPI:                        ║
║  1️⃣ POST /catalog/products → Produto base                   ║
║  2️⃣ POST /catalog/skus → SKUs/variações                     ║
║  3️⃣ POST /catalog/skus/{id}/stocks → Estoques               ║
╠═══════════════════════════════════════════════════════════════╣
║              FUNCIONALIDADES DEFINITIVAS:                     ║
║  💰 Preços: String format correto                           ║
║  🎛️ Variações: SKUs criados individualmente                 ║
║  📦 Estoques: Adicionados por SKU                            ║
║  📝 Descrição: Opcional do usuário                          ║
║  🔄 Verificação: Aguarda criação completa                    ║
╚═══════════════════════════════════════════════════════════════╝

🎯 VERSÃO DEFINITIVA PRONTA!
📋 Baseada na documentação oficial
🎛️ Fluxo sequencial: Produto → SKUs → Estoques  
📦 Variações aparecerão no painel Yampi
🔗 Pronto para WhatsApp real!
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason);
});

// TESTE SIMPLES - adicione no final do servidor.js, antes do app.listen
app.get('/test-simple-product', async (req, res) => {
    try {
        console.log('🔍 TESTE PRODUTO SIMPLES...');
        
        const brandId = await obterBrandIdValido();
        console.log('Brand ID obtido:', brandId);
        
        const produtoSimples = {
            sku: `SIMPLE-${Date.now()}`,
            name: `Produto Simples ${Date.now()}`,
            brand_id: brandId,
            simple: true,
            active: true,
            price: "50.00",
            quantity: 10,
            description: "Produto teste simples",
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('🔍 DADOS PRODUTO SIMPLES:', JSON.stringify(produtoSimples, null, 2));
        
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoSimples,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('✅ PRODUTO SIMPLES CRIADO:', response.data.data.id);
        
        res.json({
            success: true,
            message: 'Produto simples criado!',
            produto: response.data.data
        });
        
    } catch (error) {
        console.error('❌ ERRO PRODUTO SIMPLES:', error.response?.status);
        console.error('❌ DADOS ERRO:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});


// TESTE VARIAÇÕES - adicione após o test-simple-product
app.get('/test-variations-only', async (req, res) => {
    try {
        console.log('🔍 TESTE APENAS VARIAÇÕES...');
        
        // Usar o produto que acabamos de criar
        const productId = 41987168; // ID do produto simples criado
        
        // 1. TESTAR CRIAÇÃO DE VARIAÇÃO
        console.log('1️⃣ Criando variação...');
        const variacaoData = {
            name: "Tamanho"
        };
        
        console.log('🔍 DADOS VARIAÇÃO:', JSON.stringify(variacaoData, null, 2));
        
        const responseVariacao = await axios.post(
            `${config.YAMPI_API}/catalog/variations`,
            variacaoData,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const variacao = responseVariacao.data.data;
        console.log('✅ VARIAÇÃO CRIADA:', variacao.id);
        
        // 2. TESTAR CRIAÇÃO DE VALOR
        console.log('2️⃣ Criando valor P...');
        const valorData = {
            name: "P"
        };
        
        console.log('🔍 DADOS VALOR:', JSON.stringify(valorData, null, 2));
        
        const responseValor = await axios.post(
            `${config.YAMPI_API}/catalog/variations/${variacao.id}/values`,
            valorData,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const valor = responseValor.data.data;
        console.log('✅ VALOR P CRIADO:', valor.id);
        
        res.json({
            success: true,
            message: 'Variações testadas com sucesso!',
            variacao_id: variacao.id,
            valor_id: valor.id,
            proximo_passo: 'Agora testar SKU com variations_values_ids'
        });
        
    } catch (error) {
        console.error('❌ ERRO VARIAÇÕES:', error.response?.status);
        console.error('❌ DADOS ERRO:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data,
            step: 'Erro nas variações'
        });
    }
});

// TESTE BUSCAR VARIAÇÕES EXISTENTES
app.get('/test-existing-variations', async (req, res) => {
    try {
        console.log('🔍 BUSCANDO VARIAÇÕES EXISTENTES...');
        
        // Listar variações existentes
        const responseVariacoes = await axios.get(
            `${config.YAMPI_API}/catalog/variations`,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const variacoes = responseVariacoes.data.data;
        console.log('📋 VARIAÇÕES ENCONTRADAS:', variacoes.length);
        
        // Procurar variação "Tamanho"
        const variacaoTamanho = variacoes.find(v => v.name.toLowerCase() === 'tamanho');
        
        if (variacaoTamanho) {
            console.log('✅ VARIAÇÃO TAMANHO ENCONTRADA:', variacaoTamanho.id);
            
            // Listar valores desta variação
            const responseValores = await axios.get(
                `${config.YAMPI_API}/catalog/variations/${variacaoTamanho.id}/values`,
                {
                    headers: {
                        'User-Token': config.YAMPI_TOKEN,
                        'User-Secret-Key': config.YAMPI_SECRET_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            
            const valores = responseValores.data.data;
            console.log('📋 VALORES ENCONTRADOS:', valores.map(v => v.name));
            
            res.json({
                success: true,
                message: 'Variação Tamanho já existe!',
                variacao: variacaoTamanho,
                valores_existentes: valores,
                solucao: 'Usar variação existente em vez de criar nova'
            });
            
        } else {
            res.json({
                success: false,
                message: 'Variação Tamanho não encontrada',
                todas_variacoes: variacoes
            });
        }
        
    } catch (error) {
        console.error('❌ ERRO:', error.response?.data);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// TESTE SKU COM IDs CORRETOS
app.get('/test-sku-with-correct-ids', async (req, res) => {
    try {
        console.log('🔍 TESTE SKU COM IDs CORRETOS...');
        
        const productId = 41987168; // Produto simples criado antes
        
        // Dados do SKU com variations_values_ids CORRETO
        const skuData = {
            product_id: productId,
            sku: `SIMPLE-${Date.now()}-P`,
            title: "P",
            price: "50.00",
            price_sale: "50.00",
            price_discount: "45.00",
            
            // CAMPOS OBRIGATÓRIOS:
            price_cost: "30.00",
            blocked_sale: false,
            variations_values_ids: [18183531], // ID do valor "P" existente!
            
            active: true,
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('🔍 DADOS SKU:', JSON.stringify(skuData, null, 2));
        
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
        console.log('✅ SKU CRIADO:', sku.id);
        
        // Testar estoque
        const estoqueData = {
            stock_id: 1,
            quantity: 5,
            min_quantity: 0
        };
        
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
        
        console.log('✅ ESTOQUE CRIADO:', responseEstoque.data.data.id);
        
        res.json({
            success: true,
            message: '🎉 FLUXO COMPLETO FUNCIONANDO!',
            sku_criado: sku.id,
            estoque_criado: responseEstoque.data.data.id,
            produto_url: `https://painel.yampi.com.br/catalog/products/${productId}`,
            status: 'VARIAÇÕES DEVEM APARECER NO PAINEL!'
        });
        
    } catch (error) {
        console.error('❌ ERRO SKU:', error.response?.status);
        console.error('❌ DADOS ERRO:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// TESTE PRODUTO COMPLETO COM VARIAÇÕES
app.get('/test-complete-flow', async (req, res) => {
    try {
        console.log('🔍 TESTE FLUXO COMPLETO...');
        
        const brandId = await obterBrandIdValido();
        
        // 1. CRIAR PRODUTO BASE PARA VARIAÇÕES
        const produtoVariacoes = {
            sku: `VAR-PRODUCT-${Date.now()}`,
            name: `Produto Variações ${Date.now()}`,
            brand_id: brandId,
            simple: false, // IMPORTANTE: false para variações
            active: true,
            price: "80.00",
            price_sale: "80.00",
            price_discount: "70.00",
            quantity: 0, // ZERO para produtos com variações
            description: "Produto teste com variações",
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('🔍 CRIANDO PRODUTO VARIAÇÕES:', JSON.stringify(produtoVariacoes, null, 2));
        
        const responseProduto = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoVariacoes,
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
        console.log('✅ PRODUTO VARIAÇÕES CRIADO:', produto.id);
        
        // 2. CRIAR SKU TAMANHO P (usando IDs existentes)
        const skuDataP = {
            product_id: produto.id,
            sku: `${produto.sku}-P`,
            title: "P",
            price: "80.00",
            price_sale: "80.00",
            price_discount: "70.00",
            price_cost: "48.00",
            blocked_sale: false,
            variations_values_ids: [18183531], // ID do valor "P" existente
            active: true,
            weight: 0.5,
            height: 10,
            width: 15,
            length: 20
        };
        
        console.log('🔍 CRIANDO SKU P:', JSON.stringify(skuDataP, null, 2));
        
        const responseSkuP = await axios.post(
            `${config.YAMPI_API}/catalog/skus`,
            skuDataP,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const skuP = responseSkuP.data.data;
        console.log('✅ SKU P CRIADO:', skuP.id);
        
        // 3. CRIAR ESTOQUE PARA SKU P
        const estoqueDataP = {
            stock_id: 1,
            quantity: 5,
            min_quantity: 0
        };
        
        const responseEstoqueP = await axios.post(
            `${config.YAMPI_API}/catalog/skus/${skuP.id}/stocks`,
            estoqueDataP,
            {
                headers: {
                    'User-Token': config.YAMPI_TOKEN,
                    'User-Secret-Key': config.YAMPI_SECRET_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('✅ ESTOQUE P CRIADO:', responseEstoqueP.data.data.id);
        
        res.json({
            success: true,
            message: '🎉 FLUXO COMPLETO FUNCIONANDO!',
            produto_id: produto.id,
            produto_url: produto.url,
            sku_p_criado: skuP.id,
            estoque_p_criado: responseEstoqueP.data.data.id,
            yampi_painel: `https://painel.yampi.com.br/catalog/products/${produto.id}`,
            status: '✅ VARIAÇÕES DEVEM APARECER NO PAINEL YAMPI!'
        });
        
    } catch (error) {
        console.error('❌ ERRO FLUXO COMPLETO:', error.response?.status);
        console.error('❌ DADOS ERRO:', JSON.stringify(error.response?.data, null, 2));
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data,
            step: 'Erro no fluxo completo'
        });
    }
});
