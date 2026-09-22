import React, { useState, useEffect } from 'react';

export default function DashboardManutencao() {
  const [vagoes, setVagoes] = useState([]);
  const [vagaoExpandido, setVagaoExpandido] = useState(null);
  const [rolamentoSelecionado, setRolamentoSelecionado] = useState(null);
  const [calculoEngenharia, setCalculoEngenharia] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('vagoes'); // Controle das abas
  const [tempoAtualizacao, setTempoAtualizacao] = useState(15);
  const [showModalAtendimento, setShowModalAtendimento] = useState(false);
  const [formAtendimento, setFormAtendimento] = useState({ solicitante: '', urgencia: 'Média', tipo_reparo: 'Preventiva', descricao: '' });
  const [solicitando, setSolicitando] = useState(false); // NOVO: Controle do cronômetro

  // Busca os dados iniciais
  const buscarVagoes = () => {
    fetch('http://localhost:3001/api/vagoes')
      .then(res => res.json())
      .then(data => setVagoes(data))
      .catch(err => console.error("Erro ao buscar vagões:", err));
  };

// Busca dados iniciais e configura a atualização automática da interface
  // Busca dados iniciais e controla o cronômetro visual de atualização
  useEffect(() => {
    buscarVagoes();

    const cronometro = setInterval(() => {
      setTempoAtualizacao((tempoAnterior) => {
        if (tempoAnterior <= 1) {
          // Quando chegar a zero, busca os dados atualizados
          buscarVagoes();
          
          setRolamentoSelecionado((rolamentoAtual) => {
            if (rolamentoAtual) handleVerRolamento(rolamentoAtual.id);
            return rolamentoAtual;
          });
          
          return 15; // Reinicia o cronômetro para 15 segundos
        }
        return tempoAnterior - 1; // Diminui 1 segundo
      });
    }, 1000); // Roda a cada 1 segundo (1000 ms)

    return () => clearInterval(cronometro);
  }, []);

  // Busca detalhes do rolamento clicado
  const handleVerRolamento = (id) => {
    fetch(`http://localhost:3001/api/rolamentos/${id}`)
      .then(res => res.json())
      .then(data => setRolamentoSelecionado(data))
      .catch(err => console.error("Erro ao buscar rolamento:", err));
  };

  // Busca cálculo de engenharia do rolamento
  const handleBuscarCalculoEngenharia = (id) => {
    fetch(`http://localhost:3001/api/rolamentos/${id}/calculo-engenharia`)
      .then(res => res.json())
      .then(data => setCalculoEngenharia(data))
      .catch(err => console.error("Erro ao buscar cálculo:", err));
  };

  // Aciona o microsserviço Python
  const handleAnalisarIA = async (id) => {
    setAnalisando(true);
    try {
      const res = await fetch(`http://localhost:3001/api/analisar-rolamento/${id}`, { 
        method: 'POST' 
      });
      const data = await res.json();
      
      if (data.sucesso) {
        handleVerRolamento(id);
        buscarVagoes(); // Atualiza a lista para refletir o novo status
      } else {
        alert("Detalhes da falha: " + (data.erro || data.error || "Erro desconhecido"));
      }
    } catch (err) {
      console.error("ERRO COMPLETO:", err);
      alert("Motivo da falha: " + err.message);
    }
    setAnalisando(false);
  };

  const handleSolicitarAtendimento = async () => {
    if (!formAtendimento.solicitante.trim()) return;
    setSolicitando(true);
    try {
      const res = await fetch('http://localhost:3001/api/solicitar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rolamento_id: rolamentoSelecionado.id,
          ...formAtendimento
        })
      });
      const data = await res.json();
      if (data.sucesso) {
        setShowModalAtendimento(false);
        setFormAtendimento({ solicitante: '', urgencia: 'Média', tipo_reparo: 'Preventiva', descricao: '' });
        alert("Atendimento solicitado com sucesso!");
      } else {
        alert("Erro: " + (data.error || "Falha ao solicitar"));
      }
    } catch (err) {
      alert("Erro de conexão: " + err.message);
    }
    setSolicitando(false);
  };

  const getStatusColor = (rolamento) => {
    if (!rolamento) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (rolamento.nivel_severidade === 'critico') return 'bg-red-100 text-red-700 border-red-200 animate-pulse'; 
    if (rolamento.nivel_severidade === 'atencao') return 'bg-amber-100 text-amber-700 border-amber-200'; 
    return 'bg-emerald-100 text-emerald-700 border-emerald-200'; 
  };

  // Função para corrigir o caminho da imagem para o navegador
  // Função para corrigir o caminho da imagem para o navegador
  const formatarCaminhoImagem = (caminhoBanco) => {
    if (!caminhoBanco) return "https://placehold.co/600x300/png?text=Sem+Imagem";

    // Se for uma imagem da internet
    if (caminhoBanco.startsWith('http')) {
      // Se for o link antigo bloqueado, troca pelo servidor novo e seguro automaticamente
      if (caminhoBanco.includes('via.placeholder.com')) {
        return caminhoBanco.replace('https://via.placeholder.com/600x300.png', 'https://placehold.co/600x300/png');
      }
      return caminhoBanco;
    }

    // Se for uma foto física real, limpa o caminho das pastas
    let caminhoLimpo = caminhoBanco
      .replace('../frontend/public', '')
      .replace('./frontend/public', '')
      .replace('frontend/public', '');

    if (!caminhoLimpo.startsWith('/')) {
      caminhoLimpo = '/' + caminhoLimpo;
    }

    return caminhoLimpo;
  };

  // Filtra dinamicamente todos os rolamentos que estão em alerta (Score < 50)
  const rolamentosEmAlerta = vagoes.flatMap(vagao => 
    vagao.rolamentos
      .filter(rolamento => (rolamento.score_final !== undefined ? rolamento.score_final : rolamento.health_score) < 50)
      .map(rolamento => ({ ...rolamento, codigoVagao: vagao.codigo, tipoVagao: vagao.tipo }))
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* ================= BARRA LATERAL (SIDEBAR) ================= */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-10">
        
        {/* Cabeçalho com Logo e Título */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-4">
          
          {/* Imagem da Logo */}
          <img 
            src="/favicon.ico" 
            alt="Logo GATI" 
            className="w-12 h-12 object-contain" 
          />
          
          {/* Textos */}
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">GATI</h1>
            <p className="text-xs text-slate-500 mt-1">Inspeção Ferroviária</p>
          </div>
          
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {/* Aba: Vagões */}
          <button 
            onClick={() => setAbaAtiva('vagoes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              abaAtiva === 'vagoes' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            Análise Visual
          </button>

          {/* Aba: Cálculo de Engenharia */}
          <button 
            onClick={() => setAbaAtiva('calculoEngenharia')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              abaAtiva === 'calculoEngenharia' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            Cálculo de Engenharia
          </button>

          {/* Aba: Alertas */}
          <button 
            onClick={() => setAbaAtiva('alertas')}
            className={`w-full flex justify-between items-center px-4 py-3 rounded-lg transition-all ${
              abaAtiva === 'alertas' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              Alertas
            </div>
            {rolamentosEmAlerta.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {rolamentosEmAlerta.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* ================= ÁREA PRINCIPAL ================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* CABEÇALHO */}
        {/* CABEÇALHO */}
        <header className="bg-white shadow-sm px-8 py-5 flex justify-between items-center z-0">
          <h2 className="text-2xl font-bold text-slate-800">
            {abaAtiva === 'vagoes' ? 'Gestão de Vagões' : 'Alertas de Vazamentos'}
          </h2>

          {/* INDICADOR DE ATUALIZAÇÃO / LOADING */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            {tempoAtualizacao === 15 ? (
              <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
            
            <span className="text-sm font-medium text-slate-600 w-36">
              Sincronizando em <strong className="text-blue-600">{tempoAtualizacao}s</strong>
            </span>
            
            {/* Barra de Progresso Animada */}
            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(tempoAtualizacao / 15) * 100}%` }}
              ></div>
            </div>
          </div>
        </header>

        {/* CONTEÚDO (Listas + Detalhes) */}
        <div className="flex-1 flex p-8 gap-8 overflow-hidden">
          
          {/* PAINEL ESQUERDO: LISTAS DINÂMICAS */}
          <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            
            {abaAtiva === 'vagoes' ? (
              // VISÃO DE VAGÕES
              <div className="p-4 overflow-y-auto h-full">
                {vagoes.map(vagao => (
                  <div key={vagao.id} className="mb-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <button 
                      className="w-full text-left p-4 flex justify-between items-center hover:bg-slate-100 transition-colors"
                      onClick={() => setVagaoExpandido(vagaoExpandido === vagao.id ? null : vagao.id)}
                    >
                      <div>
                        <span className="font-bold text-slate-700">{vagao.codigo}</span>
                        <span className="text-xs text-slate-500 ml-2 uppercase tracking-wide border px-2 py-1 rounded-md">{vagao.tipo}</span>
                      </div>
                      <span className="text-slate-400">{vagaoExpandido === vagao.id ? '▲' : '▼'}</span>
                    </button>

                    {vagaoExpandido === vagao.id && (
                      <div className="bg-white border-t border-slate-100 divide-y divide-slate-50">
                        {vagao.rolamentos.map(rolamento => (
                          <div 
                            key={rolamento.id} 
                            className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${
                              rolamentoSelecionado?.id === rolamento.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                            }`}
                            onClick={() => handleVerRolamento(rolamento.id)}
                          >
                            <span className="text-sm text-slate-600 font-medium ml-2">{rolamento.posicao_eixo}</span>
                            <div className={`w-3 h-3 rounded-full ${
                            rolamento.nivel_severidade === 'critico' ? 'bg-red-500 animate-pulse' : 
                            rolamento.nivel_severidade === 'atencao' ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : abaAtiva === 'calculoEngenharia' ? (
              // VISÃO DE CÁLCULO DE ENGENHARIA
              <div className="p-4 overflow-y-auto h-full">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">Selecionar Rolamento:</h3>
                </div>
                {vagoes.map(vagao => (
                  <div key={vagao.id} className="mb-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <div className="w-full text-left p-4 flex justify-between items-center bg-slate-100">
                      <div>
                        <span className="font-bold text-slate-700 text-sm">{vagao.codigo}</span>
                        <span className="text-xs text-slate-500 ml-2 uppercase tracking-wide border px-2 py-1 rounded-md">{vagao.tipo}</span>
                      </div>
                    </div>
                    <div className="bg-white border-t border-slate-100 divide-y divide-slate-50">
                      {vagao.rolamentos.map(rolamento => (
                        <div 
                          key={rolamento.id} 
                          className={`p-3 cursor-pointer transition-colors ${
                            calculoEngenharia?.id === rolamento.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                          }`}
                          onClick={() => handleBuscarCalculoEngenharia(rolamento.id)}
                        >
                          <span className="text-sm text-slate-600 font-medium">{rolamento.posicao_eixo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // VISÃO DE ALERTAS
              <div className="p-4 overflow-y-auto h-full bg-red-50/30">
                {rolamentosEmAlerta.length === 0 ? (
                  <div className="text-center text-slate-500 mt-10">Nenhum alerta registrado no momento.</div>
                ) : (
                  rolamentosEmAlerta.map(rolamento => (
                    <div 
                      key={rolamento.id}
                      className={`p-4 mb-3 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-all ${
                        rolamento.nivel_severidade === 'critico' ? 'border-red-200 hover:border-red-400' : 'border-amber-200 hover:border-amber-400'
                      } ${rolamentoSelecionado?.id === rolamento.id ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => handleVerRolamento(rolamento.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-800">{rolamento.codigoVagao}</span>
                        {rolamento.nivel_severidade === 'critico' ? (
                          <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">URGENTE</span>
                        ) : (
                          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded flex items-center gap-1">⚠️ ATENÇÃO</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{rolamento.posicao_eixo}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* PAINEL DIREITO: DETALHES DO ROLAMENTO */}
          <div className="w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 p-8 overflow-y-auto relative">
            {abaAtiva === 'calculoEngenharia' ? (
              // CONTEÚDO DO CÁLCULO DE ENGENHARIA
              calculoEngenharia ? (
                <div className="animate-fade-in">
                  {/* Cabeçalho */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                    <div>
                      <h3 className="text-3xl font-bold text-slate-800 mb-2">{calculoEngenharia.posicao_eixo}</h3>
                      <p className="text-sm text-slate-500 mb-4">Cálculo de Engenharia - Vida Útil e Confiabilidade</p>
                      <div className="text-4xl font-black text-blue-600">
                        Score: {calculoEngenharia.score_final !== undefined ? calculoEngenharia.score_final : calculoEngenharia.scoreEngenharia}/100
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModalAtendimento(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-orange-600 rounded-lg shadow-md hover:bg-orange-700 hover:shadow-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 0l3.536 3.536M14.828 9.172l-3.536-3.536M3 21l3-3m0 0l3 3M6 18v-3a3 3 0 013-3h1"></path></svg>
                      Solicitar Manutenção
                    </button>
                  </div>

                  {/* Seção Principal - L10 e Vida Consumida */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                      <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 3.062v6.072A3.066 3.066 0 0117.853 15a4.582 4.582 0 01-1.497 3.686 4.582 4.582 0 01-6.712 0 4.581 4.581 0 01-1.497-3.686 3.066 3.066 0 01-2.812-3.062V6.517a3.066 3.066 0 012.812-3.062zM9 13a1 1 0 100-2 1 1 0 000 2zm3 0a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"></path></svg>
                        Vida Consumida
                      </h4>
                      <div className="text-3xl font-black text-blue-600 mb-2">{calculoEngenharia.vida_consumida_pct}%</div>
                      <div className="w-full bg-slate-300 rounded-full h-3 mb-2">
                        <div 
                          className={`h-3 rounded-full transition-all ${
                            calculoEngenharia.vida_consumida_pct > 80 ? 'bg-red-500' : 
                            calculoEngenharia.vida_consumida_pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(calculoEngenharia.vida_consumida_pct, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-600">Estimativa de vida útil consumida</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                      <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.714-1.471M15.5 13l-3.5 2-2-4"></path></svg>
                        Confiabilidade (L10)
                      </h4>
                      <div className="text-3xl font-black text-green-600 mb-2">{calculoEngenharia.confiabilidade_pct}%</div>
                      <p className="text-xs text-slate-600">Probabilidade de operação sem falhas</p>
                      <p className="text-xs text-slate-500 mt-1">Falha: {calculoEngenharia.probabilidade_falha_pct}%</p>
                    </div>
                  </div>

                  {/* Seção L10 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-sm font-bold text-slate-700 mb-2">L10 (Milhões de Revoluções)</p>
                      <p className="text-2xl font-black text-slate-800">{calculoEngenharia.L10_milhoes}</p>
                      <p className="text-xs text-slate-500 mt-1">Vida útil conforme padrão SKF</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-sm font-bold text-slate-700 mb-2">L10h (Horas Estimadas)</p>
                      <p className="text-2xl font-black text-slate-800">{calculoEngenharia.L10h_estimada.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-1">Vida útil em horas</p>
                    </div>
                  </div>

                  {/* Seção Ciclos */}
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Ciclos de Operação</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Ciclos Consumidos</p>
                        <p className="text-xl font-bold text-amber-700">{calculoEngenharia.ciclos_consumidos_pct}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Taxa de Falha Weibull</p>
                        <p className="text-xl font-bold text-amber-700">{parseFloat(calculoEngenharia.taxa_falha).toExponential(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Seção Manutenção */}
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-6">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Histórico de Manutenção</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-slate-600">Dias sem Manutenção</p>
                        <p className="text-lg font-bold text-purple-700">{calculoEngenharia.dias_sem_manutencao}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Meses sem Manutenção</p>
                        <p className="text-lg font-bold text-purple-700">{calculoEngenharia.meses_sem_manutencao}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600">Intervenções</p>
                        <p className="text-lg font-bold text-purple-700">{calculoEngenharia.quantidade_intervencoes}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Impacto na Score</p>
                        <p className="text-lg font-bold text-purple-700">-{calculoEngenharia.impacto_manutencao}</p>
                      </div>
                    </div>
                  </div>

                  {/* Seção Criticidade */}
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Índice de Criticidade Operacional</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600">Criticidade Base</p>
                        <p className="text-lg font-bold text-red-700">{calculoEngenharia.criticidade_operacional}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Criticidade Ajustada</p>
                        <p className="text-lg font-bold text-red-700">{calculoEngenharia.criticidade_ajustada}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-3">Tipo de Carga: <span className="font-bold">{calculoEngenharia.tipo_carga}</span></p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p className="text-lg">Selecione um rolamento para ver o cálculo</p>
                </div>
              )
            ) : rolamentoSelecionado ? (
              <div className="animate-fade-in">
                
                {/* Cabeçalho do Detalhe */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                  <div>
                    <h3 className="text-3xl font-bold text-slate-800 mb-2">{rolamentoSelecionado.posicao_eixo}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      {rolamentoSelecionado.localizacao_atual}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold px-4 py-2 rounded-lg border inline-block mb-2 ${getStatusColor(rolamentoSelecionado)}`}>
                    {rolamentoSelecionado.status}
                  </span>
                    <div className="text-3xl font-black text-slate-800">
                      Score: {rolamentoSelecionado.score_final !== undefined ? rolamentoSelecionado.score_final : rolamentoSelecionado.health_score}/100
                    </div>
                  </div>
                </div>

                {/* Grid de Sensores e Engenharia */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* Card de Telemetria */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
                            Telemetria
                        </h4>
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-600">Temperatura Atual:</span>
                            <span className={`font-bold ${rolamentoSelecionado.temperatura_atual > 45 ? 'text-red-600' : rolamentoSelecionado.temperatura_atual > 32.9 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                {rolamentoSelecionado.temperatura_atual}°C
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Vibração (RMS):</span>
                            <span className={`font-bold ${rolamentoSelecionado.vibracao_rms > 4.5 ? 'text-red-600' : rolamentoSelecionado.vibracao_rms >= 2.2 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                {rolamentoSelecionado.vibracao_rms} mm/s
                            </span>
                        </div>
                    </div>

                    {/* Card de Vida Útil */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Vida Útil / Confiabilidade
                        </h4>
                        
                        {/* NOVO: Linha de Horas Operadas */}
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-600">Horas Operadas:</span>
                            <span className="font-bold text-slate-800">{rolamentoSelecionado.horas_operadas} h</span>
                        </div>

                        <div className="flex justify-between mb-2">
                            <span className="text-slate-600">L10h Estimado:</span>
                            <span className="font-bold text-slate-800">{rolamentoSelecionado.detalhes_calculo?.l10h_estimado} h</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Vida Consumida:</span>
                            <span className={`font-bold ${parseFloat(rolamentoSelecionado.detalhes_calculo?.vida_consumida_pct || 0) > 80 ? 'text-red-600 animate-pulse' : 'text-emerald-600'}`}>
                                {rolamentoSelecionado.detalhes_calculo?.vida_consumida_pct}%
                            </span>
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                            <span className="text-slate-600">Confiabilidade (L10):</span>
                            <span className="font-bold text-indigo-600">{rolamentoSelecionado.detalhes_calculo?.confiabilidade_weibull_pct ?? "—"}%</span>
                        </div>
                    </div>
                </div>

                {/* Seção da Imagem e IA */}
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-4">
                    <h4 className="text-lg font-bold text-slate-700">Inspeção Visual</h4>
                    <div className="flex gap-2">
                    
                    <button 
                      onClick={() => handleAnalisarIA(rolamentoSelecionado.id)}
                      disabled={analisando}
                      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-lg shadow-md transition-all ${
                        analisando ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                      }`}
                    >
                      {analisando ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Processando IA...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          Analisar Imagem
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowModalAtendimento(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-orange-600 rounded-lg shadow-md hover:bg-orange-700 hover:shadow-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 0l3.536 3.536M14.828 9.172l-3.536-3.536M3 21l3-3m0 0l3 3M6 18v-3a3 3 0 013-3h1"></path></svg>
                      Solicitar Manutenção
                    </button>
                    </div>
                  </div>
                  
                  {rolamentoSelecionado.imagem_r2_url ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                      <img 
                        src={formatarCaminhoImagem(rolamentoSelecionado.imagem_r2_url)}
                        alt="Inferência do Rolamento" 
                        className="w-full h-80 object-cover"
                      />
                      <div className="absolute inset-0 ring-1 ring-inset ring-black/10"></div>
                    </div>
                  ) : (
                    <div className="w-full h-80 bg-slate-50 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-slate-400">
                      <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      Nenhuma imagem capturada
                    </div>
                  )}
                </div>

                {/* Log de Diagnóstico */}
                <div>
                  <h4 className="text-lg font-bold text-slate-700 mb-4">Relatório Integrado de Análise</h4>
                  <div className="space-y-3">
                    {rolamentoSelecionado.diagnostico_motivos?.map((motivo, index) => {
                      let cardClass = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                      let icon = (
                        <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                        </svg>
                      );

                      if (motivo.tipo === 'critico') {
                        cardClass = 'bg-red-50 border-red-100 text-red-800';
                        icon = (
                          <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                          </svg>
                        );
                      } else if (motivo.tipo === 'atencao') {
                        cardClass = 'bg-amber-50 border-amber-100 text-amber-800';
                        icon = (
                          <span className="text-base mr-3 mt-0.5 flex-shrink-0 leading-none">⚠️</span>
                        );
                      }

                      return (
                        <div key={index} className={`flex items-start p-4 rounded-lg border shadow-sm ${cardClass}`}>
                          {icon}
                          <p className="text-sm font-medium leading-relaxed">{motivo.texto}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <p className="text-lg">Selecione um ativo na lista para iniciar a inspeção</p>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Modal Solicitar Manutenção */}
      {showModalAtendimento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModalAtendimento(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Solicitar Manutenção</h3>
              <button onClick={() => setShowModalAtendimento(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Solicitante *</label>
                <input type="text" value={formAtendimento.solicitante} onChange={e => setFormAtendimento({...formAtendimento, solicitante: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nome do solicitante" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Urgência do Reparo</label>
                <select value={formAtendimento.urgencia} onChange={e => setFormAtendimento({...formAtendimento, urgencia: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Reparo</label>
                <select value={formAtendimento.tipo_reparo} onChange={e => setFormAtendimento({...formAtendimento, tipo_reparo: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="Preventiva">Preventiva</option>
                  <option value="Corretiva">Corretiva</option>
                  <option value="Preditiva">Preditiva</option>
                  <option value="Inspeção">Inspeção</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Descrição / Observação</label>
                <textarea value={formAtendimento.descricao} onChange={e => setFormAtendimento({...formAtendimento, descricao: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  rows="3" placeholder="Descreva o problema ou motivo da solicitação"></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowModalAtendimento(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">
                Cancelar
              </button>
              <button onClick={handleSolicitarAtendimento} disabled={solicitando || !formAtendimento.solicitante.trim()}
                className="px-5 py-2.5 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                {solicitando ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Enviando...</>
                ) : "Confirmar Solicitação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}