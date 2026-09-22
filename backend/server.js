const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./manutencao_ferroviaria.db', (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite com sucesso!");
    }
});

app.use(cors());
app.use(express.json());

// =========================================================================
// CALCULADORA DE ENGENHARIA (L10 E WEIBULL)
// =========================================================================
function calcularEngenhariaCompleta(row) {
    // Parâmetros com valores padrão
    const carga_dinamica_c = row.carga_dinamica_c || 150000;
    const carga_equivalente_p = row.carga_equivalente_p || 45000;
    const rpm_medio = row.rpm_medio || 400;
    const horas_operadas = row.horas_operadas || 5000;
    const vida_estimada_horas = row.vida_estimada_horas || 20000;
    const numero_ciclos = row.numero_ciclos || 1500;
    const data_ultima_manutencao = row.data_ultima_manutencao || '2024-06-01';
    const quantidade_intervencoes = row.quantidade_intervencoes || 1;
    const criticidade_operacional = row.criticidade_operacional || 5;
    const tipo_carga = row.tipo_carga || 'Minério de Ferro';
    const beta_weibull = row.beta_weibull || 3.0;
    const eta_weibull = row.eta_weibull || 10.0;
    const health_score = row.health_score !== undefined && row.health_score !== null ? row.health_score : 100;
    const temperatura_atual = row.temperatura_atual !== undefined && row.temperatura_atual !== null ? row.temperatura_atual : 45.0;
    const vibracao_rms = row.vibracao_rms !== undefined && row.vibracao_rms !== null ? row.vibracao_rms : 1.2;

    // 1. CÁLCULO L10 (VIDA ÚTIL)
    const p = 10 / 3;
    const L10_milhoes = Math.pow((carga_dinamica_c / carga_equivalente_p), p);
    const L10h_estimada = (1000000 / (60 * rpm_medio)) * L10_milhoes;
    const vida_consumida_pct = (horas_operadas / L10h_estimada) * 100;

    // 2. DISTRIBUIÇÃO DE WEIBULL (em horas, η derivado do L10h)
    // η = L10 / (-ln(0.9))^(1/β)  =>  R(t) = exp(-(t/η)^β)
    const fator_eta = Math.pow(-Math.log(0.9), 1 / beta_weibull);
    const eta_weibull_horas = L10h_estimada > 0 ? L10h_estimada / fator_eta : eta_weibull * 8760;
    const confiabilidade = Math.exp(-Math.pow(horas_operadas / eta_weibull_horas, beta_weibull));

    const taxa_falha = (beta_weibull / eta_weibull_horas) * Math.pow(horas_operadas / eta_weibull_horas, beta_weibull - 1);

    // 3. NÚMERO DE CICLOS
    const ciclos_esperados = (vida_estimada_horas / (horas_operadas || 1)) * numero_ciclos;
    const ciclos_consumidos_pct = (numero_ciclos / (ciclos_esperados || 1)) * 100;

    // 4. DISTÂNCIA ACUMULADA / MANUTENÇÃO
    const dias_sem_manutencao = Math.floor((new Date() - new Date(data_ultima_manutencao)) / (1000 * 60 * 60 * 24));
    const meses_sem_manutencao = Math.floor(dias_sem_manutencao / 30);
    const penalidade_manutencao = Math.min(meses_sem_manutencao / 36 * 30, 30);
    const penalidade_intervencoes = Math.min(quantidade_intervencoes * 5, 25);
    const impacto_manutencao = penalidade_manutencao + penalidade_intervencoes;

    // 5. ÍNDICE DE CRITICIDADE OPERACIONAL
    let criticidade_peso = 1.0;
    if (tipo_carga === 'Minério de Ferro') criticidade_peso = 1.3;
    const criticidade_ajustada = criticidade_operacional * criticidade_peso;

    // 6. VIDA CONSUMIDA (%)
    const vida_consumida_final = Math.min(vida_consumida_pct + (ciclos_consumidos_pct * 0.3), 100);

    // 7. SCORE FINAL DE ENGENHARIA
    let scoreEngenharia = 100 - vida_consumida_final;
    scoreEngenharia -= impacto_manutencao;
    scoreEngenharia *= (100 / criticidade_ajustada);
    scoreEngenharia = Math.max(0, Math.min(100, scoreEngenharia));

    const confiabilidadeBasePct = confiabilidade * 100;
    const confiabilidadeCompostaPct = calcularConfiabilidadeComposta(confiabilidadeBasePct, {
        health_score, temperatura_atual, vibracao_rms,
        meses_sem_manutencao, quantidade_intervencoes
    });

    return {
        L10_milhoes: L10_milhoes.toFixed(4),
        L10h_estimada: Math.round(L10h_estimada),
        vida_consumida_pct: vida_consumida_pct.toFixed(2),
        confiabilidade_pct: confiabilidadeCompostaPct.toFixed(2),
        confiabilidade_weibull_pct: confiabilidadeBasePct.toFixed(2),
        probabilidade_falha_pct: (100 - confiabilidadeCompostaPct).toFixed(2),
        taxa_falha: taxa_falha.toFixed(6),
        ciclos_consumidos_pct: ciclos_consumidos_pct.toFixed(2),
        dias_sem_manutencao: dias_sem_manutencao,
        meses_sem_manutencao: meses_sem_manutencao,
        quantidade_intervencoes: quantidade_intervencoes,
        impacto_manutencao: impacto_manutencao.toFixed(2),
        criticidade_operacional: criticidade_operacional,
        criticidade_ajustada: criticidade_ajustada.toFixed(2),
        tipo_carga: tipo_carga,
        beta_weibull: beta_weibull,
        eta_weibull_horas: Math.round(eta_weibull_horas),
        scoreEngenharia: Math.round(scoreEngenharia)
    };
}

// =========================================================================
// CÁLCULO DA CONFIABILIDADE COMPOSTA (Weibull + IA + Sensores + Manutenção)
// =========================================================================
function calcularConfiabilidadeComposta(confiabilidadeWeibullPct, opts) {
    const { health_score, temperatura_atual, vibracao_rms, meses_sem_manutencao, quantidade_intervencoes } = opts;

    // Score de IA (0-100)
    const scoreIA = health_score;

    // Score de Sensores (0-100)
    let scoreSensores = 100;
    if (temperatura_atual > 45) scoreSensores -= 50;
    else if (temperatura_atual > 33) scoreSensores -= 20;
    if (vibracao_rms > 4.5) scoreSensores -= 50;
    else if (vibracao_rms > 2.5) scoreSensores -= 12;
    else if (vibracao_rms > 1.12) scoreSensores -= 10;
    if (scoreSensores < 0) scoreSensores = 0;

    // Score de Manutenção (0-100)
    const penMeses = Math.min(meses_sem_manutencao / 36 * 30, 30);
    const penInterv = Math.min(quantidade_intervencoes * 5, 25);
    const scoreMaint = Math.max(0, 100 - penMeses - penInterv);

    // Pesos: Weibull (40%), IA (20%), Sensores (20%), Manutenção (20%)
    const composta = 0.40 * confiabilidadeWeibullPct + 0.20 * scoreIA + 0.20 * scoreSensores + 0.20 * scoreMaint;
    return Math.max(0, Math.min(100, composta));
}

// =========================================================================
// CALCULADORA UNIVERSAL DE ENGENHARIA, SENSORES E VETO CRÍTICO
// =========================================================================
function processarCalculosRolamento(row) {
    const temperatura_atual = row.temperatura_atual !== undefined && row.temperatura_atual !== null ? row.temperatura_atual : 45.0;
    const vibracao_rms = row.vibracao_rms !== undefined && row.vibracao_rms !== null ? row.vibracao_rms : 1.2;
    const carga_dinamica_c = row.carga_dinamica_c !== undefined && row.carga_dinamica_c !== null ? row.carga_dinamica_c : 150000;
    const carga_equivalente_p = row.carga_equivalente_p !== undefined && row.carga_equivalente_p !== null ? row.carga_equivalente_p : 45000;
    const rpm_medio = row.rpm_medio !== undefined && row.rpm_medio !== null ? row.rpm_medio : 400;
    const horas_operadas = row.horas_operadas !== undefined && row.horas_operadas !== null ? row.horas_operadas : 5000;

    // 1. CÁLCULO DE ENGENHARIA (L10 + Weibull)
    const p = 10 / 3;
    const L10 = Math.pow((carga_dinamica_c / carga_equivalente_p), p);
    const L10h = (1000000 / (60 * rpm_medio)) * L10;
    const vidaConsumida = (horas_operadas / L10h) * 100;

    // Weibull reliability
    const beta_w = row.beta_weibull || 3.0;
    const fator_eta_w = Math.pow(-Math.log(0.9), 1 / beta_w);
    const eta_w = L10h > 0 ? L10h / fator_eta_w : 87600;
    const confiabilidade = Math.exp(-Math.pow(horas_operadas / eta_w, beta_w));
    const confiabilidadeBasePct = confiabilidade * 100;

    // Composite reliability (Weibull + IA + Sensores + Manutenção)
    const scoreIA = row.health_score !== undefined ? row.health_score : 100;
    const data_ultima_manutencao = row.data_ultima_manutencao || '2024-06-01';
    const quantidade_intervencoes = row.quantidade_intervencoes || 0;
    const dias_sem_manutencao = Math.floor((new Date() - new Date(data_ultima_manutencao)) / (1000 * 60 * 60 * 24));
    const meses_sem_manutencao = Math.floor(dias_sem_manutencao / 30);
    const confiabilidadeCompostaPct = calcularConfiabilidadeComposta(confiabilidadeBasePct, {
        health_score: scoreIA, temperatura_atual, vibracao_rms,
        meses_sem_manutencao, quantidade_intervencoes
    });

    // Engineering score based on life consumption
    let scoreEngenharia = Math.round(Math.max(0, 100 - (vidaConsumida / 100) * 110));

    // 2. AVALIAÇÃO DOS SENSORES (Telemetria)
    let scoreSensores = 100;
    if (temperatura_atual > 45) scoreSensores -= 50;
    else if (temperatura_atual > 33) scoreSensores -= 20;

    if (vibracao_rms > 4.5){
        scoreSensores -= 50;
    } else if (vibracao_rms >= 2.2) {
        scoreSensores -= 20;
    } else if (vibracao_rms > 1.12){
        scoreSensores -= 10;
    }
    if (scoreSensores < 0) scoreSensores = 0;

    // 3. HEALTH SCORE FINAL COM PESOS DINÂMICOS

    // Dynamic weights based on life consumption
    let pesoIA, pesoSensores, pesoEng;
    if (vidaConsumida > 100) {
        pesoIA = 0.25; pesoSensores = 0.25; pesoEng = 0.50;
    } else if (vidaConsumida > 80) {
        pesoIA = 0.30; pesoSensores = 0.30; pesoEng = 0.40;
    } else if (vidaConsumida > 65) {
        pesoIA = 0.30; pesoSensores = 0.30; pesoEng = 0.40;
    } else {
        pesoIA = 0.40; pesoSensores = 0.30; pesoEng = 0.30;
    }
    let healthScoreFinal = Math.round((scoreIA * pesoIA) + (scoreSensores * pesoSensores) + (scoreEngenharia * pesoEng));
    if (healthScoreFinal < 0) healthScoreFinal = 0;

    // DEFINIÇÃO DOS TRÊS NÍVEIS DE STATUS E SEVERIDADE
    let status = 'Operação Normal';
    let nivel_severidade = 'normal';
    let is_alerta = false;

    if (scoreIA < 50) {
        status = 'Manutenção Urgente (Vazamento de Graxa)';
        healthScoreFinal = Math.min(healthScoreFinal, scoreIA);
        nivel_severidade = 'critico';
        is_alerta = true;
    } else if (scoreSensores < 50) {
        status = 'Manutenção Urgente (Sensores Críticos)';
        healthScoreFinal = Math.min(healthScoreFinal, scoreSensores);
        nivel_severidade = 'critico';
        is_alerta = true;
    } else if (healthScoreFinal < 50) {
        status = 'Manutenção Urgente (Desgaste Geral)';
        nivel_severidade = 'critico';
        is_alerta = true;
    } else if (scoreEngenharia < 50) {
        status = 'Atenção (Fim da Vida Útil)';
        nivel_severidade = 'atencao';
        is_alerta = true;
    }

    // 4. CONSTRUÇÃO DO RELATÓRIO DE ANÁLISE MULTINÍVEL
    let motivos = [];
    
    // IA
    if (scoreIA < 50) {
        motivos.push({ tipo: 'critico', texto: "A análise de imagem detectou vazamento de graxa." });
    } else {
        motivos.push({ tipo: 'normal', texto: "Sem sinais de vazamento." });
    }
    
    // Sensores
    if (scoreSensores < 50) {
        motivos.push({ tipo: 'critico', texto: `Alerta Crítico de telemetria: Temperatura a ${temperatura_atual}°C e Vibração a ${vibracao_rms} mm/s.` });
    } else if (scoreSensores < 100) {
        motivos.push({ tipo: 'atencao', texto: `Possível vazamento: Temperatura a ${temperatura_atual}°C ou Vibração a ${vibracao_rms} mm/s em patamar intermediário.` });
    } else {
        motivos.push({ tipo: 'normal', texto: `Sensores operando em níveis ideais (Temp: ${temperatura_atual}°C).` });
    }
    
    // Engenharia L10
    if (vidaConsumida > 80) {
        motivos.push({ tipo: 'critico', texto: `Alerta Crítico: A vida útil consumida atingiu limite extremo de ${vidaConsumida.toFixed(1)}%.` });
    } else if (vidaConsumida > 50) {
        motivos.push({ tipo: 'atencao', texto: `Atenção: A vida útil consumida atingiu ${vidaConsumida.toFixed(1)}% do tempo estimado.` });
    } else {
        motivos.push({ tipo: 'normal', texto: `Vida útil calculada adequada: ${vidaConsumida.toFixed(1)}% consumida.` });
    }

    return { 
        ...row, 
        temperatura_atual,
        vibracao_rms,
        carga_dinamica_c,
        carga_equivalente_p,
        rpm_medio,
        horas_operadas,
        status, 
        nivel_severidade,
        is_alerta,
        diagnostico_motivos: motivos,
        score_final: healthScoreFinal,
        detalhes_calculo: {
            l10h_estimado: Math.round(L10h),
            vida_consumida_pct: vidaConsumida.toFixed(1),
            score_sensores: scoreSensores,
            score_engenharia: Math.round(scoreEngenharia),
            confiabilidade_weibull_pct: confiabilidadeCompostaPct.toFixed(1)
        }
    };
}

// ==========================================================
// ROTINA DE VARREDURA AUTOMÁTICA EM SEGUNDO PLANO
// ==========================================================
function iniciarInspecaoAutomatica() {
    setInterval(() => {
        console.log("⚙️ [Automação] Iniciando varredura em lote dos rolamentos...");

        db.all(`SELECT id, imagem_r2_url FROM rolamentos WHERE imagem_r2_url IS NOT NULL`, [], async (err, rows) => {
            if (err || rows.length === 0) return;

            for (const row of rows) {
                try {
                    const respostaIA = await fetch('http://ia_service:5000/analisar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imagem_url: row.imagem_r2_url })
                    });
                    
                    const dadosIA = await respostaIA.json();

                    if (!dadosIA.erro) {
                        db.run(`
                            UPDATE rolamentos 
                            SET health_score = ? 
                            WHERE id = ?`, 
                            [dadosIA.health_score_ia, row.id]
                        );
                    }
                } catch (erroDeRede) {
                    console.error(`IA offline ou erro de rede ao analisar eixo [${row.id}].`);
                }
            }
        });
    }, 60000); 
}

iniciarInspecaoAutomatica();

// ==========================================================
// 1. INICIALIZAÇÃO DO BANCO DE DADOS (Tabelas e Dados Fake)
// ==========================================================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS vagoes (
        id TEXT PRIMARY KEY,
        codigo_composicao TEXT NOT NULL,
        tipo_vagao TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rolamentos (
        id TEXT PRIMARY KEY,
        vagao_id TEXT NOT NULL,
        posicao_eixo TEXT NOT NULL,
        health_score INTEGER NOT NULL,
        localizacao_atual TEXT NOT NULL,
        imagem_r2_url TEXT,
        vazamento_detectado BOOLEAN DEFAULT 0,
        temperatura_critica BOOLEAN DEFAULT 0,
        vibracao_anormal BOOLEAN DEFAULT 0,
        temperatura_atual REAL DEFAULT 45.0,
        vibracao_rms REAL DEFAULT 1.2,
        carga_dinamica_c REAL DEFAULT 150000,
        carga_equivalente_p REAL DEFAULT 45000,
        rpm_medio REAL DEFAULT 400,
        horas_operadas REAL DEFAULT 5000,
        vida_estimada_horas REAL DEFAULT 20000,
        numero_ciclos INTEGER DEFAULT 1500,
        data_ultima_manutencao TEXT DEFAULT '2024-06-01',
        quantidade_intervencoes INTEGER DEFAULT 1,
        tipo_intervencao TEXT DEFAULT 'Preventiva',
        criticidade_operacional INTEGER DEFAULT 5,
        tipo_carga TEXT DEFAULT 'Minério de Ferro',
        tipo_veiculo TEXT DEFAULT 'Gôndola',
        beta_weibull REAL DEFAULT 3.0,
        eta_weibull REAL DEFAULT 10.0,
        FOREIGN KEY (vagao_id) REFERENCES vagoes(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS solicitacoes_atendimento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rolamento_id TEXT NOT NULL,
        solicitante TEXT NOT NULL,
        urgencia TEXT NOT NULL DEFAULT 'Média',
        tipo_reparo TEXT NOT NULL DEFAULT 'Preventiva',
        descricao TEXT DEFAULT '',
        data_solicitacao TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente',
        FOREIGN KEY (rolamento_id) REFERENCES rolamentos(id) ON DELETE CASCADE
    )`);

    db.get("SELECT COUNT(*) AS count FROM vagoes", (err, row) => {
        if (row && row.count === 0) {
            console.log("Banco vazio detectado. Inserindo dados de teste...");
            
            db.run(`INSERT INTO vagoes (id, codigo_composicao, tipo_vagao) VALUES 
                ('v1', 'VALE-1029', 'Gôndola'),
                ('v2', 'VALE-3044', 'Plataforma')`);
            
            db.run(`INSERT INTO rolamentos (id, vagao_id, posicao_eixo, health_score, localizacao_atual, imagem_r2_url, temperatura_atual, vibracao_rms, horas_operadas, numero_ciclos, data_ultima_manutencao, quantidade_intervencoes, tipo_intervencao, criticidade_operacional, tipo_carga, tipo_veiculo, beta_weibull, eta_weibull) VALUES 
                ('r1', 'v1', 'Eixo 1 - Lado Direito', 100, 'Pátio Tubarão', '/imagens/1.jpeg', 46.2, 3.4, 2000, 1200, '2024-06-15', 0, 'Preventiva', 8, 'Minério de Ferro', 'Gôndola', 3.2, 10.5),
                ('r2', 'v1', 'Eixo 2 - Lado Esquerdo', 100, 'Pátio Tubarão', '/imagens/2.jpeg', 45.0, 1.2, 1293, 980, '2024-05-20', 2, 'Corretiva', 7, 'Carga Leve', 'Gôndola', 2.8, 9.0),
                ('r3', 'v2', 'Eixo 1 - Lado Direito', 100, 'Trecho Vitória-Minas', '/imagens/3.jpeg', 54.5, 4.9, 4982, 3500, '2024-03-10', 3, 'Corretiva', 9, 'Minério de Ferro', 'Plataforma', 3.5, 8.5),
                ('r4', 'v2', 'Eixo 2 - Lado Direito', 100, 'Trecho Vitória-Minas', '/imagens/4.jpeg', 48.1, 2.2, 3023, 1800, '2024-07-01', 1, 'Preventiva', 6, 'Carga Leve', 'Plataforma', 3.0, 11.0),
                ('r5', 'v1', 'Eixo 1 - Lado Esquerdo', 100, 'Pátio Tubarão', '/imagens/3.jpeg', 43.3, 0.4, 205, 150, '2024-08-01', 0, 'Preventiva', 5, 'Carga Leve', 'Gôndola', 2.5, 12.0)`);
        }
    });
});

// ==========================================================
// 2. ROTAS CORRIGIDAS DA API
// ==========================================================

// Listar todos os vagões (com tradução de nomenclatura para o React)
app.get('/api/vagoes', (req, res) => {
    db.all(`SELECT * FROM vagoes`, [], (err, vagoes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(`SELECT * FROM rolamentos`, [], (err, rolamentos) => {
            if (err) return res.status(500).json({ error: err.message });

            // Roda a calculadora preservando os IDs e propriedades dos eixos
            const rolamentosProcessados = rolamentos.map(row => processarCalculosRolamento(row));

            // Constrói a estrutura exata esperada pelo React Frontend
            const vagoesComRolamentos = vagoes.map(vagao => ({
                id: vagao.id,
                codigo: vagao.codigo_composicao, // 'codigo_composicao' vira 'codigo'
                tipo: vagao.tipo_vagao,          // 'tipo_vagao' vira 'tipo'
                rolamentos: rolamentosProcessados.filter(r => r.vagao_id === vagao.id)
            }));

            res.json(vagoesComRolamentos);
        });
    });
});

// Buscar detalhes de um único rolamento clicado
app.get('/api/rolamentos/:id', (req, res) => {
    const query = `SELECT * FROM rolamentos WHERE id = ?`;
    db.get(query, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Rolamento não encontrado" });
        
        const rolamentoProcessado = processarCalculosRolamento(row);
        res.json(rolamentoProcessado);
    });
});

// Cálculo detalhado de engenharia
app.get('/api/rolamentos/:id/calculo-engenharia', (req, res) => {
    const query = `SELECT * FROM rolamentos WHERE id = ?`;
    db.get(query, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Rolamento não encontrado" });
        
        const calculoEngenharia = calcularEngenhariaCompleta(row);
        const rolamentoProcessado = processarCalculosRolamento(row);
        res.json({
            id: row.id,
            vagao_id: row.vagao_id,
            posicao_eixo: row.posicao_eixo,
            ...calculoEngenharia,
            score_final: rolamentoProcessado.score_final
        });
    });
});

// Acionar análise manual de imagem por IA
app.post('/api/analisar-rolamento/:id', async (req, res) => {
    const rolamentoId = req.params.id;

    db.get(`SELECT imagem_r2_url FROM rolamentos WHERE id = ?`, [rolamentoId], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Rolamento não encontrado" });

        try {
            const respostaIA = await fetch('http://ia_service:5000/analisar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imagem_url: row.imagem_r2_url })
            });
            
            const dadosIA = await respostaIA.json();
            if (dadosIA.erro) return res.status(400).json(dadosIA);

            db.run(`
                UPDATE rolamentos 
                SET health_score = ?, vazamento_detectado = ? 
                WHERE id = ?`, 
                [dadosIA.health_score_ia, dadosIA.vazamento_detectado, rolamentoId],
                function(updateErr) {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    res.json({ sucesso: true, nova_nota: dadosIA.health_score_ia });
                }
            );

        } catch (erroDeRede) {
            res.status(500).json({ error: "A API Python está desligada ou inacessível." });
        }
    });
});

// Solicitar atendimento para um rolamento
app.post('/api/solicitar-atendimento', (req, res) => {
    const { rolamento_id, solicitante, urgencia, tipo_reparo, descricao } = req.body;
    if (!rolamento_id || !solicitante) {
        return res.status(400).json({ error: "rolamento_id e solicitante são obrigatórios" });
    }
    const data_solicitacao = new Date().toISOString();
    db.run(`INSERT INTO solicitacoes_atendimento (rolamento_id, solicitante, urgencia, tipo_reparo, descricao, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?)`,
        [rolamento_id, solicitante, urgencia || 'Média', tipo_reparo || 'Preventiva', descricao || '', data_solicitacao],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ sucesso: true, id: this.lastID });
        }
    );
});

// Listar solicitações de um rolamento
app.get('/api/solicitacoes/:rolamento_id', (req, res) => {
    db.all(`SELECT * FROM solicitacoes_atendimento WHERE rolamento_id = ? ORDER BY data_solicitacao DESC`, [req.params.rolamento_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3001, '0.0.0.0', () => {
    console.log('Servidor Backend rodando na porta 3001');
});