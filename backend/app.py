from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import torch, numpy as np, pandas as pd
import os, sys

# Ensure the project root is on sys.path so we can import external.predicate
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from external_code.predicate import compute_predicate, load_data

app = Flask(__name__, static_folder="../frontend", static_url_path="/")
CORS(app)

_current = dict(dataset=None, x0=None, columns=None)

@app.route("/")
def root():
    """Serve index.html so that visiting :5000 also shows the UI."""
    return send_from_directory(app.static_folder, "index.html")

@app.route("/predicate", methods=["POST"])
def predicate():
    data = request.get_json()
    dataset = data["dataset"].replace("_local", "")
    if _current["dataset"] != dataset:
        path = f"../frontend/datasets/{dataset}.csv"
        _current["x0"], _current["columns"] = load_data(path)
        _current["dataset"] = dataset

    x0, columns = _current["x0"], _current["columns"]
    subsets = np.array(data["subsets"], dtype=bool)
    lambda_a = float(data.get("lambda", 0))

    preds, quals, _ = compute_predicate(x0, subsets, columns, lambda_a)
    return jsonify(dict(predicates=preds, qualities=quals))

@app.route("/get_dataset/<dataset_name>")
def get_dataset(dataset_name):
    try:
        csv_path = f"../frontend/datasets/{dataset_name}.csv"
        df_full = pd.read_csv(csv_path)
        df = df_full.select_dtypes(include=[np.number])
        if 'x' not in df.columns or 'y' not in df.columns:
            return jsonify({"error": "Dataset must include numeric 'x' and 'y' columns"}), 400
        return jsonify(df.to_dict(orient='list'))
    except FileNotFoundError:
        return jsonify({"error": f"Dataset file not found: {dataset_name}.csv"}), 404
    except Exception as e:
        return jsonify({"error": f"Error loading dataset: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=False)

