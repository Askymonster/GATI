-- Tabela de Vagões
CREATE TABLE IF NOT EXISTS vagoes (
    id TEXT PRIMARY KEY,
    codigo_composicao TEXT NOT NULL, -- Código identificador do vagão
    tipo_vagao TEXT NOT NULL        -- Ex: Gonde, Plataforma, Hopper
);

-- Tabela de Rolamentos
CREATE TABLE IF NOT EXISTS rolamentos (
    id TEXT PRIMARY KEY,
    vagao_id TEXT NOT NULL,
    posicao_eixo TEXT NOT NULL,      -- Ex: "Eixo 1 - Lado Esquerdo"
    health_score INTEGER NOT NULL,   -- Valor de 0 a 100 [cite: 36]
    localizacao_atual TEXT NOT NULL, -- Último ponto de checagem ou trecho ferroviário
    imagem_r2_url TEXT,              -- URL da imagem armazenada no Cloudflare R2 [cite: 9, 105]
    
    -- Flags para a descrição automática de anomalias [cite: 28, 81]
    vazamento_detectado BOOLEAN DEFAULT 0,    -- [cite: 29]
    temperatura_critica BOOLEAN DEFAULT 0,    -- [cite: 30]
    vibracao_anormal BOOLEAN DEFAULT 0,       -- [cite: 31]
    
    FOREIGN KEY (vagao_id) REFERENCES vagoes(id) ON DELETE CASCADE
);