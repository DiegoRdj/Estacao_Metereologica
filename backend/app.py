
from flask import Flask, jsonify
from flask_cors import CORS
import paho.mqtt.client as mqtt
import sqlite3
import json
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

BROKER = "broker.hivemq.com"
PORTA = 1883
TOPICO = "cidadesinteligentes/estacao-tcc-01/telemetria"

BANCO = "estacao.db"

# Tempo máximo sem receber mensagens para considerar offline
TEMPO_LIMITE = 10

dados_estacao = {}
ultima_mensagem = None


# Cria o banco e a tabela
def criar_banco():
    conexao = sqlite3.connect(BANCO)

    conexao.execute("""
        CREATE TABLE IF NOT EXISTS medicoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER,
            dados TEXT
        )
    """)

    conexao.commit()
    conexao.close()


# Salva uma medição no banco
def salvar_medicao(dados):
    conexao = sqlite3.connect(BANCO)

    timestamp = dados.get("ts") or int(time.time())

    conexao.execute(
        "INSERT INTO medicoes (timestamp, dados) VALUES (?, ?)",
        (timestamp, json.dumps(dados))
    )

    conexao.commit()
    conexao.close()


# Quando conecta ao MQTT
def ao_conectar(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print("Conectado ao MQTT!")
        client.subscribe(TOPICO)
    else:
        print("Falha na conexão MQTT:", reason_code)


# Quando recebe dados do ESP32
def ao_receber(client, userdata, mensagem):
    global dados_estacao, ultima_mensagem

    try:
        novos_dados = json.loads(mensagem.payload.decode())

        if not isinstance(novos_dados, dict):
            raise ValueError("Formato de telemetria inválido")

        dados_estacao = novos_dados
        ultima_mensagem = time.time()

        salvar_medicao(dados_estacao)

        print("Dados recebidos e salvos:", dados_estacao)

    except Exception as erro:
        print("Erro ao processar mensagem:", erro)


# Inicialização
criar_banco()

cliente = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2
)

cliente.on_connect = ao_conectar
cliente.on_message = ao_receber

cliente.connect(BROKER, PORTA, 60)
cliente.loop_start()


# Rota dos dados atuais
@app.route("/dados")
def obter_dados():
    agora = time.time()

    online = (
        ultima_mensagem is not None
        and agora - ultima_mensagem <= TEMPO_LIMITE
    )

    horario = None

    if ultima_mensagem is not None:
        horario = datetime.fromtimestamp(
            ultima_mensagem
        ).strftime("%H:%M:%S")

    resposta = dados_estacao.copy()

    resposta["online"] = online
    resposta["ultima_atualizacao"] = horario
    resposta["segundos_sem_dados"] = (
        int(agora - ultima_mensagem)
        if ultima_mensagem is not None
        else None
    )

    return jsonify(resposta)


# Rota do histórico
@app.route("/historico")
def obter_historico():
    conexao = sqlite3.connect(BANCO)

    resultados = conexao.execute("""
        SELECT dados FROM medicoes
        ORDER BY id DESC
        LIMIT 100
    """).fetchall()

    conexao.close()

    historico = []

    for linha in reversed(resultados):
        historico.append(json.loads(linha[0]))

    return jsonify(historico)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )
