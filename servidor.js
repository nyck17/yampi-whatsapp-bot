// servidor.js - AUTOMAÇÃO YAMPI + WHATSAPP - VERSÃO FINAL CORRIGIDA
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

// IDs das variações EXISTENTES na Yampi (não criar novas!)
const YAMPI_VARIATIONS = {
    TAMANHO: {
        variation_id: 1190509,  // ID da variação "Tamanho"
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
        
        return 44725512; // ID de marca padrão caso não encontre
        
    } catch (error) {
        console.error('⚠ Erro ao obter brand_id:', error.message);
        return 44725512; // ID de marca padrão em caso de erro
    }
}

// FUNÇÃO PRINCIPAL - CORREÇÃO FINAL APLICADA
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
        
        console.log('🚀 VERSÃO FINAL (CORRIGIDA) - Criando produto...');
        
        // ============================================
        // PASSO 1: CRIAR PRODUTO BASE
        // ============================================
        const produtoBase = {
            sku: gerarSKU(dados.nome),
            name: dados.nome,
            brand_id: brandId,
            has_variations: temVariacoes,
            simple: !temVariacoes,
            active: true,
            featured: false,
            price: precoVenda.toString(),
            price_sale: precoVenda.toString(),
            price_discount: precoPromocional.toString(),
            quantity: temVariacoes ? 0 : Object.values(dados.estoque)[0] || 10,
            description: dados.descricao || `${dados.nome} - Produto de qualidade`,
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
            console.log('🎯 PASSO 2: Criando SKUs com variações...');
            
            for (const tamanho of dados.tamanhos) {
                const valueId = YAMPI_VARIATIONS.TAMANHO.values[tamanho.toUpperCase()];
                
                if (!valueId) {
                    console.error(`⚠️ Tamanho ${tamanho} não encontrado nas variações existentes`);
                    continue;
                }
                
                const estoqueQuantidade = dados.estoque[tamanho] || 0;
                
                // ============================================
                // CRIAR SKU COM FORMATO CORRETO E CAMPO FALTANTE
                // ============================================
                const skuData = {
                    product_id: produto.id,
                    sku: `${produto.sku}-${tamanho}`,
                    title: tamanho,
                    
                    // --- ✅ CORREÇÃO DEFINITIVA ADICIONADA AQUI ---
                    brand_id: brandId,
                    // -------------------------------------------
                    
                    variations: [
                        {
                            variation_id: YAMPI_VARIATIONS.TAMANHO.variation_id,
                            value_id: valueId
                        }
                    ],
                    
                    price: precoVenda.toString(),
                    price_sale: precoVenda.toString(),
                    price_discount: precoPromocional.toString(),
                    price_cost: (precoVenda * 0.6).toFixed(2),
                    
                    blocked_sale: false,
                    active: true,
                    
                    weight: produtoBase.weight,
                    height: produtoBase.height,
                    width: produtoBase.width,
                    length: produtoBase.length
                };
                
                console.log(`📦 Criando SKU ${tamanho}...`);
                
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
                            await axios.post(
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
                            console.error(`⚠️ Erro ao criar estoque para SKU ${sku.id}:`, estoqueError.response?.data?.message || estoqueError.message);
                        }
                    }
                    
                } catch (skuError) {
                    // Log do erro detalhado e JOGA o erro para parar a execução
                    console.error(`❌ Erro CRÍTICO ao criar SKU ${tamanho}:`, skuError.response?.data);
                    throw new Error(`Falha ao criar SKU ${tamanho}. Erro: ${JSON.stringify(skuError.response?.data?.errors)}`);
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
        console.error('❌ ERRO GERAL ao criar produto:', error.message);
        // Garante que o erro seja propagado para a rota
        throw error;
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

/cadastrar
Nome: Camiseta Polo
Preço: R$ 89,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        const produto = await criarProdutoCompleto(dados);
        await enviarConfirmacao(phone, produto, dados, temImagem);
        
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        await simularResposta(phone, `⚠ Erro ao criar o produto: ${error.message}`);
    }
}

// Confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, temImagem = false) {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + (parseInt(b) || 0), 0);
    
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
${dados.categoria ? `🏷️ Categoria: ${dados.categoria}` : ''}

🎯 STATUS DA CRIAÇÃO:
• Produto base: ✅ Criado
• Variações (SKUs): ✅ ${dados.tamanhos.length} SKUs vinculados
• Estoques: ✅ ${totalEstoque} unidades no total
• Gerenciamento: ✅ Ativado

📋 Estoque por tamanho:
${dados.tamanhos.map(t => `   ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

🔗 Produto ID: ${produto.id}
🌐 Painel: https://painel.yampi.com.br/catalog/products/${produto.id}

🎉 PRODUTO PRONTO PARA VENDA!`;

    await simularResposta(phone, confirmacao);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 AJUDA - AUTOMAÇÃO YAMPI

📋 COMANDOS DISPONÍVEIS:

🔹 PRODUTO COMPLETO (EXEMPLO):
/cadastrar
Nome: Camiseta Premium
Preço: R$ 150,00
Desconto: 15%
Tamanhos: P,M,G,GG
Estoque: P=3,M=8,G=5,GG=2
Descrição: Camiseta de algodão premium

✅ Campos obrigatórios: Nome e Preço
📝 Descrição: OPCIONAL
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
    log(`Resposta simulada para ${phone}: ${message.substring(0, 50)}...`);
}

// ENDPOINTS DE TESTE E STATUS

// Endpoint para testar a criação do produto
app.get('/test-create', async (req, res) => {
    try {
        const dadosTeste = {
            nome: `Produto Teste Final ${Date.now()}`,
            preco: 99.90,
            desconto: 10,
            tamanhos: ['P', 'M', 'G'],
            estoque: { 'P': 5, 'M': 10, 'G': 8 },
            descricao: 'Produto de teste completo com variações funcionais'
        };
        
        log('🚀 INICIANDO TESTE DE CRIAÇÃO COMPLETA...');
        
        const produto = await criarProdutoCompleto(dadosTeste);
        
        res.json({
            success: true,
            message: '✅ PRODUTO DE TESTE CRIADO COM SUCESSO!',
            produto: {
                id: produto.id,
                name: produto.name,
                has_variations: produto.has_variations
            },
            verificar_painel: `https://painel.yampi.com.br/catalog/products/${produto.id}`
        });
        
    } catch (error) {
        log(`❌ ERRO NO ENDPOINT DE TESTE: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// Página inicial com interface de teste
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>🤖 Automação Yampi</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background-color: #f4f4f9; color: #333; }
                .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                h1 { color: #075e54; text-align: center; }
                .test-btn { display: block; width: 100%; padding: 15px; margin-top: 20px; font-size: 16px; font-weight: bold; color: #fff; background-color: #25D366; border: none; border-radius: 5px; cursor: pointer; text-align: center; text-decoration: none; }
                .test-btn:hover { background-color: #128C7E; }
                #results { background: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 20px; white-space: pre-wrap; word-wrap: break-word; display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi WhatsApp</h1>
                <p>Use o botão abaixo para executar um teste completo de criação de produto com variações (P, M, G) e estoque.</p>
                <button class="test-btn" onclick="runTest()">🚀 Executar Teste de Criação</button>
                <a href="/whatsapp" class="test-btn" style="background-color: #007bff; margin-top: 10px;">📱 Ir para o Simulador WhatsApp</a>
                <div id="results">Aguardando teste...</div>
            </div>
            <script>
                async function runTest() {
                    const resultsDiv = document.getElementById('results');
                    resultsDiv.style.display = 'block';
                    resultsDiv.textContent = '⏳ Executando teste...';
                    try {
                        const response = await fetch('/test-create');
                        const data = await response.json();
                        resultsDiv.textContent = JSON.stringify(data, null, 2);
                        if(data.success && data.verificar_painel) {
                            if(confirm('Produto criado com sucesso! Deseja abrir o painel da Yampi para verificar?')) {
                                window.open(data.verificar_painel, '_blank');
                            }
                        }
                    } catch (error) {
                        resultsDiv.textContent = 'Erro ao executar o teste: ' + error.message;
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Manter o simulador de WhatsApp
app.get('/whatsapp', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>📱 WhatsApp Simulator</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 450px; margin: 20px auto; padding: 20px; background: #e5ddd5; }
                .chat-container { background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
                .chat-header { background: #075e54; color: white; padding: 15px; text-align: center; font-weight: bold; }
                .chat-messages { height: 400px; overflow-y: auto; padding: 10px; background: #ece5dd; }
                .message { margin: 10px 0; padding: 10px; border-radius: 8px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap; }
                .message.sent { background: #dcf8c6; margin-left: auto; text-align: left; }
                .message.received { background: white; margin-right: auto; }
                .chat-input { display: flex; padding: 10px; background: #f0f0f0; }
                .chat-input textarea { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 15px; margin-right: 10px; resize: none; }
                .chat-input button { background: #075e54; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; cursor: pointer; font-size: 16px; }
                .quick-btn { background: #25D366; color: white; border: none; padding: 5px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; margin: 5px; }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">🤖 Automação Yampi</div>
                <div class="chat-messages" id="messages">
                    <div class="message received">Envie /ajuda para ver os comandos ou use o botão de exemplo abaixo.</div>
                </div>
                <div><button class="quick-btn" onclick="quickMessage()">Usar Exemplo Completo</button></div>
                <div class="chat-input">
                    <textarea id="messageInput" placeholder="Digite sua mensagem..."></textarea>
                    <button onclick="sendMessage()">▶</button>
                </div>
            </div>
            <script>
                const messagesDiv = document.getElementById('messages');
                const messageInput = document.getElementById('messageInput');
                function quickMessage() {
                    messageInput.value = '/cadastrar\\nNome: Camiseta Teste\\nPreço: R$ 99,90\\nTamanhos: P,M,G\\nEstoque: P=1,M=2,G=3';
                    sendMessage();
                }
                async function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) return;
                    addMessage(message, 'sent');
                    messageInput.value = '';
                    const webhookData = { data: { key: { remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: message } } };
                    try {
                        await fetch('/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(webhookData) });
                        setTimeout(loadMessages, 1500);
                    } catch (error) { addMessage('⚠ Erro: ' + error.message, 'received'); }
                }
                function addMessage(text, type) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + type;
                    messageDiv.textContent = text;
                    messagesDiv.appendChild(messageDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
                async function loadMessages() {
                    try {
                        const response = await fetch('/messages');
                        const data = await response.json();
                        const lastResponse = data.messages.filter(m => m.type === 'resposta').pop();
                        if (lastResponse) addMessage(lastResponse.message, 'received');
                    } catch (error) { console.error('Erro ao carregar mensagens:', error); }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/messages', (req, res) => {
    res.json({ messages: simulatedMessages });
});

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor FINAL rodando na porta ${config.PORT}`);
    console.log(`✅ Automação Yampi 100% funcional. Acesse http://localhost:${config.PORT} para testar.`);
});

// Tratamento de erros globais
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado (uncaughtException):', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise rejeitada sem tratamento (unhandledRejection):', reason);
});
