let chart;
  let currentLayout = localStorage.getItem('uesb_org_layout') || 'top';
  let isCompact = localStorage.getItem('uesb_org_compact') !== 'false';
  let sidebarCollapsed = localStorage.getItem('uesb_sidebar_collapsed') === 'true';
  let currentVisualization = localStorage.getItem('uesb_visualization') || 'tree';
  let radialChartData = [];

  function changeVisualization(type) {
    currentVisualization = type;
    localStorage.setItem('uesb_visualization', type);
    
    $('#viz-tree, #viz-radial').removeClass('active');
    $(`#viz-${type}`).addClass('active');
    
    if (type === 'tree') {
      $('#chart-container').show();
      $('#radial-container').hide();
      $('.controls').show();
      $('#legend').show();
      if (chart) chart.fit().render();
    } else {
      $('#chart-container').hide();
      $('.controls').hide();
      $('#legend').hide();
      $('#radial-container').show();
      renderRadialChart();
    }
  }

  function closeTutorial() {
    $('#tutorial').fadeOut();
    localStorage.setItem('uesb_tutorial_seen', 'true');
  }

  function renderRadialChart() {
    $('#radial-container').empty();
    const width = $('#radial-container').width();
    const height = $('#radial-container').height();
    const radius = Math.min(width, height) / 2 - 30;

    const dataHierarchy = d3.hierarchy(radialChartData[0], d => d.children);
    const cluster = d3.cluster().size([2 * Math.PI, radius]);
    cluster(dataHierarchy);

    const svg = d3.select('#radial-container')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));

    // Reset highlights when clicking empty space
    svg.on('click', () => {
      g.selectAll('.node-circle')
        .attr('opacity', 1)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 3);
      g.selectAll('.node-text')
        .attr('opacity', 1)
        .style('font-weight', '700');
      g.selectAll('.link')
        .attr('opacity', 1);
    });

    // Draw concentric circles for hierarchical levels
    const yValues = Array.from(new Set(dataHierarchy.descendants().map(d => d.y)));
    const bgGroup = g.append('g').attr('class', 'radial-bg');
    yValues.forEach(y => {
      if (y > 0) {
        bgGroup.append('circle')
          .attr('r', y)
          .attr('fill', 'none')
          .attr('stroke', '#eef2f7')
          .attr('stroke-dasharray', '5 5')
          .attr('stroke-width', 1.5);
      }
    });

    g.selectAll('.link')
      .data(dataHierarchy.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#d0d7de')
      .attr('stroke-width', 2)
      .attr('d', d3.linkRadial()
        .angle(d => d.x)
        .radius(d => d.y));

    const node = g.selectAll('.node')
      .data(dataHierarchy.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation(); // Prevent svg click from resetting
        
        const targetDepth = d.depth;
        
        // Dim all
        g.selectAll('.node-circle')
          .attr('opacity', 0.2)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 3);
        g.selectAll('.node-text')
          .attr('opacity', 0.2)
          .style('font-weight', '700');
        g.selectAll('.link')
          .attr('opacity', 0.15);

        // Highlight same level
        g.selectAll('.node').filter(n => n.depth === targetDepth)
          .select('.node-circle')
          .attr('opacity', 1)
          .attr('stroke', '#e67e22') // Highlight border
          .attr('stroke-width', 4);
        g.selectAll('.node').filter(n => n.depth === targetDepth)
          .select('.node-text')
          .attr('opacity', 1)
          .style('font-weight', '900');
          
        showDetails(d.data.id);
      });

    node.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => d.depth === 0 ? 25 : d.depth === 1 ? 18 : 12)
      .attr('fill', d => d.data.color || '#3498db')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .style('transition', 'all 0.3s ease');

    node.append('text')
      .attr('class', 'node-text')
      .attr('dy', '0.31em')
      .attr('x', d => d.x < Math.PI === !d.children ? 20 : -20)
      .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
      .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
      .text(d => d.data.sigla || d.data.name)
      .style('font-size', d => d.depth === 0 ? '14px' : d.depth === 1 ? '11px' : '9px')
      .style('font-weight', '700')
      .style('fill', '#2d3748')
      .style('transition', 'all 0.3s ease');
  }

  function saveState() {
    localStorage.setItem('uesb_org_layout', currentLayout);
    localStorage.setItem('uesb_org_compact', isCompact);
    localStorage.setItem('uesb_sidebar_collapsed', $('#sidebar').hasClass('collapsed'));
  }

  let isExpanded = false; // Estado para os botões Expandir/Recolher

  function toggleExpand(expand) {
    if (!chart) return;
    isExpanded = expand;
    
    const btnExpand = document.getElementById('btn-expand');
    const btnCollapse = document.getElementById('btn-collapse');
    
    if (expand) {
      chart.expandAll().render();
      btnExpand.classList.add('active');
      btnCollapse.classList.remove('active');
    } else {
      chart.collapseAll().render();
      btnCollapse.classList.add('active');
      btnExpand.classList.remove('active');
    }
  }

  function toggleSidebar() {
    const sidebar = $('#sidebar');
    const icon = $('#toggle-icon');
    sidebar.toggleClass('collapsed');
    
    if (sidebar.hasClass('collapsed')) {
      icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
    } else {
      icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');
    }
    
    saveState();
    
    // Redimensionar o gráfico após a transição da barra lateral
    setTimeout(() => {
      if (chart) chart.render();
    }, 310);
  }

  function changeLayout(layout) {
    if (!chart) return;
    currentLayout = layout;
    
    // Update active button UI
    $('.control-btn[id^="layout-"]').removeClass('active');
    $(`#layout-${layout}`).addClass('active');
    
    chart.layout(layout).render().fit();
    saveState();
  }

  function changeCompact(state) {
    if (!chart) return;
    isCompact = state;
    
    // Update active button UI
    $('#mode-compact, #mode-expanded').removeClass('active');
    if (state) $('#mode-compact').addClass('active');
    else $('#mode-expanded').addClass('active');
    
    chart.compact(state).render().fit();
    saveState();
  }

  async function downloadPdf() {
    $('#loading').show(); 
    
    const sendLog = (level, message, error = null) => {
      let stackStr = undefined;
      if (error) {
        if (error.stack) stackStr = error.stack;
        else stackStr = JSON.stringify(error);
      }
      
      console[level](message, error || '');
      const baseUrl = window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '';
      const apiUrl = `${baseUrl}/api/logs`;
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          level: level === 'error' ? 'error' : 'info', 
          message, 
          stack: stackStr,
          context: 'PDF'
        })
      }).catch(e => console.error('Falha ao enviar log para o backend', e));
    };

    let originalStyles = {}; // Para restaurar depois da captura

    try {
      sendLog('info', 'Iniciando processo de geração de PDF no cliente.');
      const { jsPDF } = window.jspdf;
      
      const containerId = currentVisualization === 'tree' ? '#chart-container' : '#radial-container';
      const container = document.querySelector(containerId);
      const svg = d3.select(`${containerId} svg`);
      const g = svg.select('g:first-of-type');

      if (!container || svg.empty() || g.empty()) {
        throw new Error('Elementos do gráfico não encontrados na tela.');
      }

      sendLog('info', `Preparando visualização (${currentVisualization}) em tamanho real (100% zoom).`);

      // 1. Salvar estilos originais para restaurar depois
      originalStyles = {
        transform: g.attr('transform'),
        svgWidth: svg.style('width'),
        svgHeight: svg.style('height'),
        contWidth: container.style.width,
        contHeight: container.style.height,
        contOverflow: container.style.overflow,
        contPosition: container.style.position,
        contZIndex: container.style.zIndex
      };

      // 2. Forçar escala 1 para descobrir o tamanho real do gráfico (BBox)
      g.attr('transform', 'translate(0,0) scale(1)');
      const bbox = g.node().getBBox();
      
      // Adicionando um padding de segurança de 100px
      const fullWidth = Math.max(bbox.width + 200, 1000); 
      const fullHeight = Math.max(bbox.height + 200, 1000);

      // 3. Centralizar o gráfico considerando o BBox negativo
      g.attr('transform', `translate(${-bbox.x + 100}, ${-bbox.y + 100}) scale(1)`);

      // 4. Expandir o SVG e o Container para acomodar TODO o gráfico na tela em escala 1:1
      svg.style('width', `${fullWidth}px`);
      svg.style('height', `${fullHeight}px`);
      
      // Removemos o overflow para evitar barras de rolagem sendo fotografadas, e flutuamos por cima de tudo
      container.style.width = `${fullWidth}px`;
      container.style.height = `${fullHeight}px`;
      container.style.overflow = 'visible';
      container.style.position = 'absolute'; 
      container.style.zIndex = '9999';

      // Aguarda o navegador refazer o layout
      await new Promise(r => setTimeout(r, 800));

      sendLog('info', `Tamanho real do gráfico calculado: ${fullWidth}x${fullHeight} pixels. Iniciando captura...`);

      // 5. Determinar uma escala segura para não estourar a memória do navegador (Canvas Limit)
      // Se a árvore estiver toda aberta, fullWidth pode passar de 15000px.
      let safeScale = 3;
      if (fullWidth > 5000 || fullHeight > 5000) safeScale = 2;
      if (fullWidth > 10000 || fullHeight > 10000) safeScale = 1.5;
      if (fullWidth > 15000 || fullHeight > 15000) safeScale = 1;

      const canvas = await html2canvas(container, {
        scale: safeScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      sendLog('info', `Captura finalizada. Escala aplicada: ${safeScale}. Gerando PDF dinâmico...`);

      // 6. Configurar o PDF dinamicamente: a página do PDF terá O MESMO TAMANHO da imagem!
      // 1 pixel equivale aproximadamente a 0.264583 mm
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidthMm = canvas.width * 0.264583;
      const pdfHeightMm = canvas.height * 0.264583;
      
      const pdf = new jsPDF({
        orientation: pdfWidthMm > pdfHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidthMm, pdfHeightMm] // Tamanho de folha infinito/customizado
      });
      
      // Inserir a imagem ocupando a página inteira, sem amassar ou redimensionar!
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
      pdf.save('organograma-uesb.pdf');
      
      sendLog('info', 'PDF customizado de altíssima definição gerado com sucesso!');
      
    } catch (error) {
      const errorMsg = error ? (error.message || JSON.stringify(error) || String(error)) : 'Erro desconhecido e sem objeto de erro';
      sendLog('error', `Falha crítica durante a geração do PDF: ${errorMsg}`, error);
      alert(`Ocorreu um erro ao gerar o arquivo PDF. Os detalhes foram enviados aos logs.\nMensagem: ${errorMsg}`);
    } finally {
      // 7. Restaurar a tela para o estado normal (invisível para o usuário que foi super-expandido)
      if (originalStyles.transform) {
        const containerId = currentVisualization === 'tree' ? '#chart-container' : '#radial-container';
        const container = document.querySelector(containerId);
        const svg = d3.select(`${containerId} svg`);
        const g = svg.select('g:first-of-type');

        g.attr('transform', originalStyles.transform);
        svg.style('width', originalStyles.svgWidth);
        svg.style('height', originalStyles.svgHeight);
        
        container.style.width = originalStyles.contWidth;
        container.style.height = originalStyles.contHeight;
        container.style.overflow = originalStyles.contOverflow;
        container.style.position = originalStyles.contPosition;
        container.style.zIndex = originalStyles.contZIndex;
        
        // Re-centraliza a visualização no viewport da tela do usuário
        if (currentVisualization === 'tree') chart.fit();
      }

      $('#loading').fadeOut();
    }
  }

  $(function() {
    // Aplicar estado inicial da sidebar
    if (sidebarCollapsed) {
      $('#sidebar').addClass('collapsed');
      $('#toggle-icon').removeClass('fa-chevron-left').addClass('fa-chevron-right');
    }

    if (!localStorage.getItem('uesb_tutorial_seen')) {
      $('#tutorial').css('display', 'flex');
    }

    const baseUrl = window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '';
    const apiUrl = `${baseUrl}/api/unidades`;
    fetch(apiUrl)
      .then(res => {
        if (!res.ok) throw new Error('Erro HTTP ' + res.status);
        return res.json();
      })
      .then(data => {
        $('#loading').fadeOut();
        
        // Preparar dados para o d3-org-chart
        const colors = ['#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#e74c3c', '#1abc9c', '#34495e'];
        
        // Função para calcular o nível real baseado no parentId
        const dataMap = new Map(data.map(item => [item.id, item]));
        function getLevel(id, currentLevel = 0) {
          const item = dataMap.get(id);
          if (!item || item.parent === "#" || !item.parent) return currentLevel;
          return getLevel(item.parent, currentLevel + 1);
        }

        const chartData = data.map(d => {
          const level = getLevel(d.id);
          const nodeColor = colors[level % colors.length];
          
          return {
            id: d.id,
            parentId: d.parent === "#" ? null : d.parent,
            name: d.data.nome,
            sigla: d.data.sigla,
            color: nodeColor,
            level: level,
            allData: d.data
          };
        });

        // Preparar DADOS HIERÁRQUICOS ANINHADOS para o Radial
        const chartDataMap = new Map(chartData.map(item => [item.id, { ...item, children: [] }]));
        const rootNodes = [];
        chartData.forEach(item => {
          if (item.parentId === null || !chartDataMap.has(item.parentId)) {
            rootNodes.push(chartDataMap.get(item.id));
          } else {
            chartDataMap.get(item.parentId).children.push(chartDataMap.get(item.id));
          }
        });
        radialChartData = rootNodes;

        // Gerar Legenda
        const maxLevel = Math.max(...chartData.map(d => d.level));
        let legendHtml = '';
        for (let i = 0; i <= Math.min(maxLevel, colors.length - 1); i++) {
          legendHtml += `
            <div class="legend-item">
              <div class="legend-color" style="background: ${colors[i]}"></div>
              <span>Nível ${i + 1}</span>
            </div>
          `;
        }
        $('#legend').html(legendHtml);

        chart = new d3.OrgChart()
          .container('#chart-container')
          .data(chartData)
          .layout(currentLayout) // Aplicar layout salvo
          .compact(isCompact) // Aplicar modo compacto salvo
          .nodeHeight(d => 85)
          .nodeWidth(d => 220)
          .childrenMargin(d => 60)
          .compactMarginBetween(d => 35)
          .compactMarginPair(d => 30)
          .neighbourMargin(d => 40)
          .siblingsMargin(d => 40)
          .nodeContent(function(d, i, arr, state) {
            const color = d.data.color;
            const isSelected = d.data._highlighted;
            return `
              <div class="node-card" style="font-family: 'Inter', sans-serif; background-color: white; border: ${isSelected ? '2px solid #e67e22' : '1px solid #e4e2e2'}; border-radius: 10px; width: ${d.width}px; height: ${d.height}px; box-shadow: ${isSelected ? '0 0 15px rgba(230, 126, 34, 0.4)' : '0 4px 10px rgba(0,0,0,0.08)'}; transition: all 0.3s; cursor: pointer;">
                <div style="background-color: ${isSelected ? '#e67e22' : color}; height: 5px; border-radius: 10px 10px 0 0;"></div>
                <div style="padding: 12px;">
                  <div style="color: ${isSelected ? '#e67e22' : color}; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>${d.data.sigla || '---'}</span>
                    <span style="opacity: 0.5; font-size: 9px;">#${d.data.id}</span>
                  </div>
                  <div style="color: #2c3e50; font-size: 13px; font-weight: 600; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${d.data.name}
                  </div>
                </div>
              </div>
            `;
          })
          .onNodeClick(function(d) {
            // No d3-org-chart v3, o parâmetro d pode ser o ID ou o objeto de dados dependendo da versão
            // Vamos garantir que pegamos o ID correto
            const id = typeof d === 'object' ? (d.id || d.data.id) : d;
            console.log('Node clicked:', id);
            showDetails(id);
          })
          .render();

        // Aplicar classe ativa nos botões corretos
        $(`#layout-${currentLayout}`).addClass('active');
        if (isCompact) $('#mode-compact').addClass('active');
        else $('#mode-expanded').addClass('active');
        $(`#viz-${currentVisualization}`).addClass('active');
        
        // Aplicar estado inicial de visualização
        changeVisualization(currentVisualization);

        // Função para mostrar detalhes
        window.showDetails = function(nodeId) {
          const node = chartData.find(item => item.id == nodeId);
          if (node) {
            const info = node.allData;
            console.log('Displaying data for:', info);
            
            $('#detail-overlay').css('display', 'flex').hide().fadeIn();
            $('#det-titulo').text(info.nome || 'Sem nome');
            $('#det-header').css('background', node.color);

            // Função auxiliar para formatar booleanos e nulos
            const formatValue = (val, type = 'text') => {
              if (val === null || val === undefined || val === '') return '---';
              if (typeof val === 'boolean') {
                const text = val ? 'Sim' : 'Não';
                const className = val ? 'boolean-true' : 'boolean-false';
                return `<span class="${className}">${text}</span>`;
              }
              if (type === 'date') {
                try {
                  return new Date(val).toLocaleDateString('pt-BR');
                } catch(e) { return val; }
              }
              return val;
            };

            // Preenchimento de campos específicos
            $('#field-nome').text(info.nome || '---');
            $('#field-nome_capa').text(info.nome_capa || '---');
            $('#field-sigla').text(info.sigla || '---');
            
            // Lógica para buscar nomes das unidades responsáveis
            const getUnitLink = (id) => {
              if (!id) return '<span class="detail-value">---</span>';
              const unit = chartData.find(u => u.id == id);
              if (unit) {
                return `
                  <div class="search-item" style="padding: 6px 10px; border: 1px solid #eef2f7; border-radius: 6px; margin-top: 2px; background: white;" onclick="showDetails(${unit.id})">
                    <span class="item-sigla" style="font-size: 0.65rem;">${unit.sigla || '---'}</span>
                    <span class="item-nome" style="font-size: 0.8rem;">${unit.name}</span>
                  </div>
                `;
              }
              return `<span class="detail-value">ID: ${id} (Não carregada)</span>`;
            };

            $('#field-unid_resp_org').html(getUnitLink(info.id_unid_resp_org));
            $('#field-id_gestora').html(getUnitLink(info.unidade_responsavel)); // Corrigido: Unidade Responsável Orçamentária é unidade_responsavel
            $('#field-id_gestora_academica').html(getUnitLink(info.id_gestora_academica));

            $('#field-codigo_unidade').text(info.codigo_unidade || '---');
            $('#field-categoria').text(info.categoria || '---');
            $('#field-data_inicio_vigencia').text(formatValue(info.data_inicio_vigencia, 'date'));
            $('#field-data_fim_vigencia').text(formatValue(info.data_fim_vigencia, 'date'));
            $('#field-visivel_apos_desativacao').html(formatValue(info.visivel_apos_desativacao));
            $('#field-id_campus').text(info.id_campus || '---');
            $('#field-endereco').text(info.endereco || '---');
            $('#field-cep').text(info.cep || '---');
            $('#field-municipio').text(`${info.municipio || '---'} - ${info.uf || '--'}`);

            // Sistemas Gov
            $('#field-codigo_siapecad').text(info.codigo_siapecad || '---');
            $('#field-codigo_unidade_gestora_siafi').text(info.codigo_unidade_gestora_siafi || '---');
            $('#field-codigo_gestao_siafi').text(info.codigo_gestao_siafi || '---');
            $('#field-codigo_siorg').text(info.codigo_siorg || '---');

            // Permissões
            $('#field-organizacional').html(formatValue(info.organizacional));
            $('#perm-unid_resp_org').html(getUnitLink(info.id_unid_resp_org)); // Link na seção de permissões
            $('#field-unidade_orcamentaria_bool').html(formatValue(info.unidade_orcamentaria)); // Corrigido: unidade_orcamentaria é o boolean
            $('#field-patrimonial').html(formatValue(info.patrimonial));
            $('#field-formula_licitacoes').html(formatValue(info.compradora || info.compradora_engenharia)); // Mapeamento provável
            $('#field-academica').html(formatValue(info.academica));

            // Dados Acadêmicos (Subseção)
            if (info.academica) {
              $('#sub-academica').show();
              $('#field-tipo_academica').text(info.tipo_academica || '---');
              $('#field-sigla_academica').text(info.sigla_academica || '---');
              $('#perm-id_gestora_academica').html(getUnitLink(info.id_gestora_academica));
            } else {
              $('#sub-academica').hide();
            }

            $('#field-metas').html(formatValue(info.metas));
            $('#field-protocolizadora').html(formatValue(info.protocolizadora));

            // Hierarquia: Pai e Filhos
            const parentNode = chartData.find(item => item.id == node.parentId);
            if (parentNode) {
              $('#det-superior').html(`
                <div class="search-item" style="padding: 8px; border: 1px solid #eee; border-radius: 6px; margin-top: 5px;" onclick="showDetails(${parentNode.id})">
                  <span class="item-sigla" style="font-size: 0.65rem;">${parentNode.sigla || '---'}</span>
                  <span class="item-nome" style="font-size: 0.8rem;">${parentNode.name}</span>
                </div>
              `);
            } else {
              $('#det-superior').html('<span class="detail-value">Esta é a unidade raiz</span>');
            }

            const childrenNodes = chartData.filter(item => item.parentId == node.id);
            if (childrenNodes.length > 0) {
              let childrenHtml = '<div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">';
              childrenNodes.forEach(child => {
                childrenHtml += `
                  <div class="search-item" style="padding: 8px; border: 1px solid #eee; border-radius: 6px;" onclick="showDetails(${child.id})">
                    <span class="item-sigla" style="font-size: 0.65rem;">${child.sigla || '---'}</span>
                    <span class="item-nome" style="font-size: 0.8rem;">${child.name}</span>
                  </div>
                `;
              });
              childrenHtml += '</div>';
              $('#det-subordinadas').html(childrenHtml);
            } else {
              $('#det-subordinadas').html('<span class="detail-value">Nenhuma unidade subordinada</span>');
            }
            
            // Focar no nó no organograma
            chart.setCentered(nodeId).render();
          }
        };

        // Busca
        $('#search-input').on('input', function() {
          const value = $(this).val().toLowerCase();
          const resultsContainer = $('#search-results');
          const infoContainer = $('#sidebar-info');
          
          if (!value) {
            resultsContainer.hide().empty();
            infoContainer.show();
            chartData.forEach(d => d._highlighted = false);
            chart.render();
            return;
          }

          const matches = chartData.filter(d => 
            d.name.toLowerCase().includes(value) || 
            (d.sigla && d.sigla.toLowerCase().includes(value))
          );

          infoContainer.hide();
          resultsContainer.show().empty();

          if (matches.length === 0) {
            resultsContainer.append('<div style="padding: 20px; color: #999; text-align: center;">Nenhum resultado encontrado</div>');
          } else {
            matches.forEach(m => {
              const item = $(`
                <div class="search-item">
                  <span class="item-sigla">${m.sigla || '---'}</span>
                  <span class="item-nome">${m.name}</span>
                </div>
              `);
              item.on('click', () => showDetails(m.id));
              resultsContainer.append(item);
            });
          }

          // Marcar no gráfico
          chartData.forEach(d => {
            d._highlighted = (d.name.toLowerCase().includes(value) || 
                              (d.sigla && d.sigla.toLowerCase().includes(value)));
          });
          chart.render();
        });
      })
      .catch(err => {
        console.error(err);
        $('#loading').html(`<div class="error" style="color: red; padding: 20px;">Erro ao carregar dados: ${err.message}</div>`);
      });
  });