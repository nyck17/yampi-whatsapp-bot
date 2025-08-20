// CORREÇÃO PARA O servidor.js - Parte da configuração da API

// 1. CONFIGURAÇÃO CORRETA (início do arquivo)
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE || 'griffestreet'}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN || 'cIBCz75dH3HVD8WvPpy8vy9XXjj7ZNovUafTXJXI',
    PORT: process.env.PORT || 3000
};

// 2. FUNÇÃO DE TESTE MELHORADA
app.get('/test-yampi', async (req, res) => {
    try {
        console.log('🔍 Testando conexão com API Yampi...');
        console.log('Store:', process.env.YAMPI_STORE || 'griffestreet');
        console.log('Token length:', config.YAMPI_TOKEN.length);
        console.log('API URL:', config.YAMPI_API);
        
        // Teste simples - listar produtos
        const testResponse = await axios.get(
            `${config.YAMPI_API}/catalog/products`,
            {
                headers: {
                    'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'yampi-whatsapp-bot/1.0'
                },
                params: {
                    limit: 1
                }
            }
        );
        
        console.log('✅ API funcionando!');
        
        res.json({
            success: true,
            message: '✅ API Yampi conectada com sucesso!',
            store: process.env.YAMPI_STORE || 'griffestreet',
            status: testResponse.status,
            products_count: testResponse.data.meta?.total || 0,
            test_product: testResponse.data.data?.[0]?.name || 'Nenhum produto encontrado'
        });
        
    } catch (error) {
        console.error('❌ Erro teste Yampi:', error.message);
        
        // Log detalhado do erro
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
            console.error('Headers:', error.response.headers);
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data,
            details: {
                url: `${config.YAMPI_API}/catalog/products`,
                token_exists: !!config.YAMPI_TOKEN,
                token_length: config.YAMPI_TOKEN?.length,
                store: process.env.YAMPI_STORE || 'griffestreet'
            }
        });
    }
});

// 3. FUNÇÃO CRIAR PRODUTO CORRIGIDA
async function criarProdutoYampi(dados) {
    // Preparar dados do produto
    const produtoData = {
        name: dados.nome,
        description: dados.descricao || `${dados.nome} - Cadastrado via WhatsApp`,
        price: dados.preco.toString(), // Yampi espera string
        cost: "0",
        sku: gerarSKU(dados.nome),
        status: "active",
        weight: "0",
        height: "0",
        width: "0",
        length: "0"
    };
    
    console.log('📦 Criando produto:', produtoData.name);
    console.log('URL:', `${config.YAMPI_API}/catalog/products`);
    
    try {
        const response = await axios.post(
            `${config.YAMPI_API}/catalog/products`,
            produtoData,
            {
                headers: {
                    'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'yampi-whatsapp-bot/1.0'
                }
            }
        );
        
        console.log('✅ Produto criado com sucesso! ID:', response.data.data.id);
        return response.data.data;
        
    } catch (error) {
        console.error('❌ Erro ao criar produto:', error.response?.data || error.message);
        throw new Error(
            error.response?.data?.message || 
            error.response?.data?.error || 
            'Erro ao criar produto na Yampi'
        );
    }
}

// 4. TESTE RÁPIDO DE CRIAÇÃO
app.get('/test-create', async (req, res) => {
    try {
        const testProduct = {
            nome: `Produto Teste ${Date.now()}`,
            preco: 29.90,
            descricao: 'Produto de teste criado automaticamente',
            tamanhos: ['Único'],
            estoque: { 'Único': 10 },
            categoria: 'Testes'
        };
        
        console.log('🧪 Criando produto de teste...');
        const produto = await criarProdutoYampi(testProduct);
        
        res.json({
            success: true,
            message: '✅ Produto de teste criado com sucesso!',
            produto: {
                id: produto.id,
                nome: produto.name,
                sku: produto.sku,
                preco: produto.price
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5. ADICIONE ESTE LOG NO INÍCIO DO SERVIDOR
app.listen(config.PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║                   FUNCIONANDO                    ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE na porta ${config.PORT}              ║
║  ✅ Yampi Store: ${process.env.YAMPI_STORE || 'griffestreet'}                     ║
║  ✅ Token: ${config.YAMPI_TOKEN ? 'CONFIGURADO (' + config.YAMPI_TOKEN.length + ' chars)' : 'NÃO CONFIGURADO'}     ║
║  ✅ WhatsApp: SIMULADOR ATIVO                    ║
╠══════════════════════════════════════════════════╣
║              ENDPOINTS DE TESTE:                 ║
║  📍 /test-yampi - Testa conexão com API          ║
║  📍 /test-create - Cria produto de teste         ║
║  📍 /whatsapp - Simulador WhatsApp               ║
╚══════════════════════════════════════════════════╝
    `);
});
