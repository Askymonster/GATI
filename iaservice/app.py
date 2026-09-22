from flask import Flask, request, jsonify
from tensorflow.keras.preprocessing import image # type: ignore
import numpy as np
import os
import tensorflow as tf
import urllib.request
import ssl
from PIL import Image
import io # <-- Faltava esse import para baixar imagens da internet!

original_dense_init = tf.keras.layers.Dense.__init__

def dense_hack_init(self, *args, **kwargs):
    kwargs.pop('quantization_config', None) 
    original_dense_init(self, *args, **kwargs) 

# Substituímos a função oficial do sistema pela nossa!
tf.keras.layers.Dense.__init__ = dense_hack_init

# =================================================================

app = Flask(__name__)

# Agora não precisamos de custom_objects. A função nativa já está protegida.
modelo_tcc = tf.keras.models.load_model('modelo.keras')
print("✅ Modelo carregado com sucesso na memória!") # <-- O nosso farol para ler no terminal do Docker

# A MÁGICA QUE FALTAVA: Essa linha avisa o Flask para abrir a porta /analisar na rede!
@app.route('/analisar', methods=['POST'])
def analisar():
    dados = request.json
    imagem_url = dados.get('imagem_url')

    if not imagem_url:
        return jsonify({"erro": "Nenhuma URL de imagem fornecida"}), 400

    try:
        # --- CASO A: FOTO DE TESTE DA INTERNET (PLACEHOLDER HTTP) ---
        if imagem_url.startswith('http'):
            # Ignora regras de segurança chatas de SSL
            contexto_inseguro = ssl._create_unverified_context()
            req = urllib.request.Request(imagem_url, headers={'User-Agent': 'Mozilla/5.0'})
            resposta = urllib.request.urlopen(req, context=contexto_inseguro)
            img_pil = Image.open(io.BytesIO(resposta.read()))
            
            # Converte e redimensiona para 64x64 como o seu modelo exige
            img_pil = img_pil.convert('RGB')
            img_pil = img_pil.resize((64, 64))
            img_array = image.img_to_array(img_pil)

        # --- CASO B: FOTO REAL DO PROJETO NA PASTA DO DOCKER ---
        else:
            if not imagem_url.startswith('/'):
                imagem_url = '/' + imagem_url
            caminho_local = f"/frontend/public{imagem_url}"
            
            if not os.path.exists(caminho_local):
                return jsonify({"erro": f"Imagem não encontrada: {caminho_local}"}), 404
                
            img = image.load_img(
                caminho_local,
                color_mode='rgb',
                target_size=(64, 64)
            )
            img_array = image.img_to_array(img)

        # --- O SEU CÓDIGO DE PRÉ-PROCESSAMENTO E INFERÊNCIA ---
        img_array = img_array / 255.0
        img_array = tf.expand_dims(img_array, 0)

        previsao = modelo_tcc.predict(img_array)
        probabilidade = float(previsao[0][0])

        # Definição dos dois estados exclusivos
        if probabilidade > 0.5:
            estado = "Vazamento de Graxa Detectado"
            health_score = 0
        else:
            estado = "Não Detectado"
            health_score = 100

        return jsonify({
            "health_score_ia": health_score,
            "estado_detectado": estado,
            "certeza_ruim_pct": round(probabilidade * 100, 2)
        })

    except Exception as e:
        return jsonify({"erro": f"Falha na análise: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)