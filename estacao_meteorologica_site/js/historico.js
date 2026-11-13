
const API_HISTORICO = "http://127.0.0.1:5000/historico";

const graficos = {};

const configuracoesGraficos = [
    {
        id: "grafico-temperatura",
        campo: "temp_dht",
        titulo: "Temperatura",
        unidade: "°C"
    },
    {
        id: "grafico-umidade",
        campo: "umidade",
        titulo: "Umidade",
        unidade: "%"
    },
    {
        id: "grafico-pressao",
        campo: "pressao",
        titulo: "Pressão",
        unidade: "hPa"
    },
    {
        id: "grafico-luminosidade",
        campo: "luz_pct",
        titulo: "Luminosidade",
        unidade: "%"
    },
    {
        id: "grafico-ar",
        campo: "mq_bruto",
        titulo: "Qualidade do ar",
        unidade: ""
    },
    {
        id: "grafico-chuva",
        campo: "chuva_bruto",
        titulo: "Sensor de chuva",
        unidade: "ADC"
    }
];

function obterDataMedicao(medicao) {
    let timestamp = Number(medicao.ts);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return "Sem data";
    }

    if (timestamp < 100000000000) {
        timestamp *= 1000;
    }

    return new Date(timestamp).toLocaleString("pt-BR");
}

function obterRotulo(medicao, indice) {
    const data = obterDataMedicao(medicao);

    if (data === "Sem data") {
        return `Medição ${indice + 1}`;
    }

    return data;
}

function criarOuAtualizarGrafico(config, historico) {
    const canvas = document.getElementById(config.id);

    if (!canvas) {
        console.warn("Canvas não encontrado:", config.id);
        return;
    }

    const labels = historico.map((medicao, indice) =>
        obterRotulo(medicao, indice)
    );

    const valores = historico.map(medicao => {
        const valor = medicao[config.campo];

        if (valor === null || valor === undefined || valor === "") {
            return null;
        }

        const numero = Number(valor);

        return Number.isFinite(numero) ? numero : null;
    });

    if (graficos[config.id]) {
        graficos[config.id].data.labels = labels;
        graficos[config.id].data.datasets[0].data = valores;
        graficos[config.id].update();
        return;
    }

    graficos[config.id] = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: `${config.titulo} ${config.unidade}`,
                data: valores,
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56, 189, 248, 0.12)",
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.3,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#cbd5e1"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#94a3b8",
                        maxTicksLimit: 6,
                        maxRotation: 0
                    },
                    grid: {
                        color: "rgba(148, 163, 184, 0.10)"
                    }
                },
                y: {
                    ticks: {
                        color: "#94a3b8"
                    },
                    grid: {
                        color: "rgba(148, 163, 184, 0.10)"
                    }
                }
            }
        }
    });
}

function preencherTabela(historico) {
    const corpo = document.getElementById("corpo-tabela");
    corpo.innerHTML = "";

    if (historico.length === 0) {
        corpo.innerHTML =
            '<tr><td colspan="7">Nenhuma medição encontrada.</td></tr>';
        return;
    }

    const recentes = [...historico].reverse();

    recentes.forEach(medicao => {
        const linha = document.createElement("tr");

        const statusChuva =
            medicao.chuva_status ??
            (
                medicao.chuva_detectada === true
                    ? "Chuva detectada"
                    : medicao.chuva_detectada === false
                        ? "Sem chuva"
                        : "--"
            );

        const valores = [
            obterDataMedicao(medicao),
            medicao.temp_dht ?? "--",
            medicao.umidade ?? "--",
            medicao.pressao ?? "--",
            medicao.luz_pct ?? "--",
            medicao.mq_bruto ?? "--",
            `${statusChuva} (${medicao.chuva_bruto ?? "--"})`
        ];

        valores.forEach(valor => {
            const celula = document.createElement("td");
            celula.textContent = valor;
            linha.appendChild(celula);
        });

        corpo.appendChild(linha);
    });
}

async function carregarHistorico() {
    const mensagem = document.getElementById("mensagem-status");
    const botao = document.getElementById("btn-atualizar");

    botao.disabled = true;
    mensagem.textContent = "Carregando medições...";

    try {
        const resposta = await fetch(API_HISTORICO, {
            cache: "no-store"
        });

        if (!resposta.ok) {
            throw new Error("Não foi possível consultar o histórico.");
        }

        const historico = await resposta.json();

        if (!Array.isArray(historico)) {
            throw new Error("O formato recebido pelo histórico é inválido.");
        }

        configuracoesGraficos.forEach(config => {
            criarOuAtualizarGrafico(config, historico);
        });

        preencherTabela(historico);

        document.getElementById("total-registros").textContent =
            `${historico.length} ${historico.length === 1 ? "registro" : "registros"}`;

        mensagem.textContent = historico.length
            ? "Histórico atualizado com sucesso."
            : "O banco ainda não possui medições.";

    } catch (erro) {
        console.error("Erro ao carregar histórico:", erro);

        mensagem.textContent =
            "Não foi possível carregar o histórico. Verifique se o Flask está ligado.";

    } finally {
        botao.disabled = false;
    }
}

document.getElementById("btn-atualizar")
    .addEventListener("click", carregarHistorico);

carregarHistorico();
