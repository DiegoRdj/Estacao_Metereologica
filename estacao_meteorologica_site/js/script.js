const API = "http://127.0.0.1:5000/dados";

// Busca os dados do Flask e atualiza o painel
async function atualizarDashboard() {
    const indicador = document.getElementById("status-indicador");
    const textoStatus = document.getElementById("status-texto");

    try {
        const resposta = await fetch(API, { cache: "no-store" });

        if (!resposta.ok) {
            throw new Error("O servidor não respondeu corretamente.");
        }

        const dados = await resposta.json();

        // Mantém os últimos valores recebidos nos cards, mesmo offline.
        if (dados.temp_dht !== undefined && dados.temp_dht !== null) {
            document.getElementById("temperatura").textContent =
                `${dados.temp_dht} °C`;

            document.getElementById("umidade").textContent =
                `${dados.umidade ?? "--"} %`;

            document.getElementById("pressao").textContent =
                `${dados.pressao ?? "--"} hPa`;

            document.getElementById("luminosidade").textContent =
                `${dados.luz_pct ?? "--"} %`;

            document.getElementById("qualidade-ar").textContent =
                dados.mq_bruto ?? "--";

            document.getElementById("chuva").textContent =
                dados.chuva_status ??
                (dados.chuva_detectada === true
                    ? "Chuva detectada"
                    : dados.chuva_detectada === false
                        ? "Sem chuva"
                        : "--");

            verificarAlertas(dados);
        }

        // O Flask informa se houve mensagem MQTT nos últimos 10 segundos.
        if (dados.online === true) {
            indicador.classList.add("conectado");
            indicador.classList.remove("desconectado");
            textoStatus.textContent = "Estação conectada";
        } else {
            indicador.classList.remove("conectado");
            indicador.classList.add("desconectado");
            textoStatus.textContent = "Estação offline";
        }

        const ultimaAtualizacao =
            document.getElementById("ultima-atualizacao");

        if (dados.ultima_atualizacao) {
            ultimaAtualizacao.textContent =
                `Última atualização: ${dados.ultima_atualizacao}`;
        } else {
            ultimaAtualizacao.textContent =
                "Aguardando primeira medição...";
        }

    } catch (erro) {
        console.error("Erro ao atualizar dashboard:", erro);

        indicador.classList.remove("conectado");
        indicador.classList.add("desconectado");
        textoStatus.textContent = "Servidor indisponível";
    }
}


// Verifica condições extremas
function verificarAlertas(dados) {
    const lista = document.getElementById("lista-alertas");
    const alertas = [];

    if (Number(dados.temp_dht) >= 35) {
        alertas.push("Temperatura muito alta!");
    } else if (Number(dados.temp_dht) <= 10) {
        alertas.push("Temperatura muito baixa!");
    }

    if (Number(dados.umidade) >= 80) {
        alertas.push("Umidade muito alta!");
    } else if (Number(dados.umidade) <= 30) {
        alertas.push("Umidade muito baixa!");
    }

    lista.innerHTML = "";

    if (alertas.length === 0) {
        const mensagem = document.createElement("p");
        mensagem.textContent = "✅ Nenhum alerta no momento.";
        lista.appendChild(mensagem);
        return;
    }

    alertas.forEach(alerta => {
        const aviso = document.createElement("p");
        aviso.className = "alerta";
        aviso.textContent = `⚠️ ${alerta}`;
        lista.appendChild(aviso);
    });
}


// Inicializa o mapa
const mapa = L.map("mapa").setView([-23.5505, -46.6333], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
}).addTo(mapa);

let marcador = null;

// Solicita a localização do dispositivo
if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
        posicao => {
            const latitude = posicao.coords.latitude;
            const longitude = posicao.coords.longitude;

            mapa.setView([latitude, longitude], 17);

            if (marcador) {
                mapa.removeLayer(marcador);
            }

            marcador = L.marker([latitude, longitude])
                .addTo(mapa)
                .bindPopup("Estação Meteorológica")
                .openPopup();

            document.getElementById("coordenadas").textContent =
                `Latitude: ${latitude.toFixed(6)} | Longitude: ${longitude.toFixed(6)}`;
        },
        () => {
            document.getElementById("coordenadas").textContent =
                "Não foi possível obter a localização. Verifique a permissão do navegador.";
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
} else {
    document.getElementById("coordenadas").textContent =
        "Seu navegador não suporta geolocalização.";
}


// Primeira atualização e atualização automática a cada 3 segundos
atualizarDashboard();
setInterval(atualizarDashboard, 3000);
