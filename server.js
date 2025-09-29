// --- PARTE 1: CONFIGURAÇÃO INICIAL ---
// 'dotenv' é usado para ler as chaves do Supabase das Environment Variables no Render.com
require('dotenv').config(); 
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

// --- PARTE 2: CONEXÃO COM O SUPABASE ---
// As chaves foram inseridas diretamente no código
const supabaseUrl = 'https://jwlvgrkgxpvtjdnmeuog.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bHZncmtneHB2dGpkbm1ldW9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg4OTczMiwiZXhwIjoyMDc0NDY1NzMyfQ.wL_nsZJkCtfB6QwKT_0yGcq2g6471NL-nfIbwvsQxss'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// --- LISTA FINAL DE LOTERIAS E URLs --- (Sem alterações)
const loteriasParaScrapear = [
    { nome: 'LOOK', url: 'https://bichocerto.com/resultados/lk/look/' },
    { nome: 'LOTEP', url: 'https://bichocerto.com/resultados/pb/pt-lotep/' },
    { nome: 'LOTECE', url: 'https://bichocerto.com/resultados/lce/lotece/' },
    { nome: 'LBR', url: 'https://bichocerto.com/resultados/lbr/brasilia/' },
    { nome: 'MALUCA', url: 'https://bichocerto.com/resultados/mba/maluquinha-bahia/' },
    { nome: 'FEDERAL', url: 'https://bichocerto.com/resultados/fd/loteria-federal/' },
    { nome: 'RIO', url: 'https://bichocerto.com/resultados/rj/para-todos/' },
    { nome: 'SP/BAND', url: 'https://bichocerto.com/resultados/sp/pt-band/' },
    { nome: 'NACIONAL', url: 'https://bichocerto.com/resultados/ln/loteria-nacional/' }
];


// --- FUNÇÃO "ESPECIALISTA" FINAL PARA O BICHOCERTO.COM --- (Sem alterações)
async function scrapeBichoCerto(loteriaInfo) {
    const { nome, url } = loteriaInfo;
    let browser = null;
    try {
        console.log(`- [BichoCerto] Iniciando: ${nome}`);
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const html = await page.content();
        await browser.close();

        const $ = cheerio.load(html);
        const resultadosDaPagina = [];
        const dataSorteio = new Date();

        const items = $('div.col-lg-4.mb-4').length ? $('div.col-lg-4.mb-4') : $('article.result');

        items.each((index, element) => {
            const item = $(element);
            const titulo = item.find('h5.card-title, header h3').first().text().trim();
            const horarioMatch = titulo.match(/(\d{2}:\d{2})/i) || titulo.match(/(\d{2}h)/i);
            const horario = horarioMatch ? horarioMatch[0].replace('h', ':00') : 'N/A';

            item.find('table tbody tr, .result-group-item').each((i, row) => {
                if (i >= 7) return false;

                const tds = $(row).find('td');
                let posicao, milhar, grupo, bicho;

                if (tds.length > 0) { // Layout de Tabela
                    if ($(tds[0]).attr('colspan') || tds.length < 4) return;
                    posicao = $(tds[0]).text().trim();
                    if (tds.length === 5) {
                        milhar = $(tds[2]).find('a').text().trim() || $(tds[2]).text().trim();
                        grupo = $(tds[3]).text().trim();
                        bicho = $(tds[4]).text().trim();
                    } else {
                        milhar = $(tds[1]).find('a').text().trim() || $(tds[1]).text().trim();
                        grupo = $(tds[2]).text().trim();
                        bicho = $(tds[3]).text().trim();
                    }
                } else { // Layout de Divs (Nacional e outros)
                    posicao = $(row).find('.prize').text().trim();
                    milhar = $(row).find('.number').text().trim();
                    const animalText = $(row).find('.animal-name').text().trim();
                    const grupoMatch = animalText.match(/\((\d+)\)/);
                    if(grupoMatch) {
                        grupo = grupoMatch[1];
                        bicho = animalText.replace(/\(\d+\)\s*/, '').trim();
                    }
                }
                
                if (milhar && bicho && grupo && !isNaN(parseInt(grupo))) {
                    resultadosDaPagina.push({ 
                        loteria: nome, 
                        horario, 
                        bicho, 
                        grupo: parseInt(grupo), 
                        milhar, 
                        posicao,
                        data_sorteio: dataSorteio.toISOString() 
                    });
                }
            });
        });

        console.log(`- [BichoCerto] Finalizado: ${nome}. ${resultadosDaPagina.length} resultados encontrados.`);
        return resultadosDaPagina;
    } catch (error) {
        console.error(`- [BichoCerto] Erro em ${url}: ${error.message}`);
        if (browser) await browser.close();
        return [];
    }
}

// --- NOVA FUNÇÃO "CHEFE DE OPERAÇÕES" ---
// Esta função agora contém toda a lógica e será chamada diretamente
async function rodarProcessoDeScraping() {
    try {
        const hoje = new Date();
        const diaDaSemana = hoje.getDay();
        
        let loteriasParaHoje = loteriasParaScrapear.filter(loteria => {
            if (loteria.nome === 'FEDERAL') return false;
            return true;
        });

        if (diaDaSemana === 3 || diaDaSemana === 6) { // 3 = Quarta, 6 = Sábado
            console.log("Hoje é dia de Federal! Adicionando à lista de tarefas.");
            const federalInfo = loteriasParaScrapear.find(l => l.nome === 'FEDERAL');
            if(federalInfo) loteriasParaHoje.push(federalInfo);
        }

        console.log(`Chefe de operações iniciando scraping de ${loteriasParaHoje.length} loterias...`);
        const todosOsResultados = [];
        for (const loteria of loteriasParaHoje) {
            const resultadosDaPagina = await scrapeBichoCerto(loteria);
            todosOsResultados.push(...resultadosDaPagina);
        }

        console.log(`Total de ${todosOsResultados.length} resultados encontrados em todas as fontes.`);
        if (todosOsResultados.length > 0) {
            const inicioDoDia = new Date();
            inicioDoDia.setHours(0, 0, 0, 0);
            
            // Apaga os resultados de hoje antes de inserir os novos para evitar duplicados
            console.log("Limpando resultados antigos de hoje...");
            const { error: deleteError } = await supabase.from('resultados').delete().gte('data_sorteio', inicioDoDia.toISOString());
            if (deleteError) {
                console.error("Erro ao limpar dados antigos:", deleteError.message);
                // Decide se quer parar ou continuar mesmo com o erro. Por agora, vamos continuar.
            }
            
            const uniqueResults = Array.from(new Map(todosOsResultados.map(item => [JSON.stringify(item), item])).values());
            console.log(`Inserindo ${uniqueResults.length} resultados únicos...`);

            const { data, error } = await supabase.from('resultados').insert(uniqueResults).select();
            if (error) { throw new Error(`Erro ao salvar no Supabase: ${error.message}`); }

            console.log('Scraping geral concluído e dados salvos com sucesso no Supabase!');
        } else {
            console.log('Nenhum resultado foi encontrado hoje.');
        }
    } catch (error) {
        console.error('Ocorreu um erro geral no processo de scraping:', error);
        // Em um ambiente de produção, você pode querer notificar um erro aqui
        // O process.exit(1) informa ao Render que a tarefa falhou.
        process.exit(1); 
    }
}

// --- PONTO DE ENTRADA DO SCRIPT ---
// O Render irá executar "node server.js", que chamará esta função.
rodarProcessoDeScraping();

