# app.py
# ------------------------------------------------------------
# Dash app: select rectangle on scatter, grey that area, then
# run your predicate and recolor the final points—all in one plot.
# ------------------------------------------------------------
import pathlib
import json

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import torch
from torch import nn, optim

from dash import Dash, dcc, html, Input, Output, State, no_update, callback_context

# ------------------------------------------------------------
# 0 · Configuration
# ------------------------------------------------------------
CSV_FILE       = "animals5.csv"   # must live in the same folder
TOTAL_EPOCHS   = 100              # number of SGD steps
A_INIT         = 0.4              # initial 'a' value in your code

# ------------------------------------------------------------
# 1 · Your existing predicate code (unchanged except returning final pred)
# ------------------------------------------------------------
def predict(x: torch.Tensor, a: torch.Tensor, mu: torch.Tensor, b: int = 5) -> torch.Tensor:
    """
    UMAP-inspired bump function:
      pred_i = 1 / [1 + sum_j |a_j| * |x_i,j - mu_j|^b]
    """
    return 1.0 / (1.0 + ((a.abs() * (x - mu).abs()) ** b).sum(1))


def fit_predicate_final(
    x0: np.ndarray,
    mask: np.ndarray,
    n_iter: int = TOTAL_EPOCHS,
    a_init: float = A_INIT,
    device=None,
) -> np.ndarray:
    """
    Run your single-region predicate optimizer for n_iter steps,
    then return the final prediction vector (length = n_points).
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    x0 = x0.astype(np.float32)
    mask = mask.astype(bool)
    n_points, n_features = x0.shape

    # --- normalize exactly as in your code
    x = torch.from_numpy(x0).to(device)
    y = torch.from_numpy(mask.astype(np.float32)).to(device)
    mean = x.mean(0)
    scale = x.std(0) + 0.1
    x = (x - mean) / scale

    # --- initialize a, mu around the selected points' centroid
    centre = x[mask].mean(0)
    a = (a_init + 0.1 * (2 * torch.rand(n_features) - 1)).to(device)
    mu = centre + 0.1 * (2 * torch.rand(n_features) - 1).to(device)
    a.requires_grad_(True)
    mu.requires_grad_(True)

    # --- class-balanced BCE loss
    w = torch.ones(n_points, device=device)
    n_sel = mask.sum()
    n_unsel = n_points - n_sel
    w[mask] = n_points / n_sel
    w[~mask] = n_points / n_unsel
    bce = nn.BCELoss(weight=w)

    opt = optim.SGD([{"params": mu}, {"params": a}], lr=1e-2, momentum=0.9)
    for _ in range(n_iter):
        pred = predict(x, a, mu)
        loss = bce(pred, y) + (mu - centre).pow(2).mean() * 20.0
        opt.zero_grad()
        loss.backward()
        opt.step()

    with torch.no_grad():
        final_pred = predict(x, a, mu).cpu().numpy()

    return final_pred


# ------------------------------------------------------------
# 2 · Load data and build initial figure
# ------------------------------------------------------------
csv_path = pathlib.Path(CSV_FILE)
if not csv_path.exists():
    raise FileNotFoundError(f"Cannot find '{CSV_FILE}' in this folder.")

df = pd.read_csv(csv_path)
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if len(numeric_cols) < 2:
    raise ValueError("Dataset needs at least two numeric columns.")

# Choose two numeric columns to plot (you can adjust these defaults if you like)

x_axis = numeric_cols[len(numeric_cols) - 2]
y_axis = numeric_cols[len(numeric_cols) - 1]
coords = df[[x_axis, y_axis]].to_numpy(dtype=np.float32)

# Build a base scatter plot (all points blue)
base_fig = px.scatter(
    df,
    x=x_axis,
    y=y_axis,
    color_discrete_sequence=["#1f77b4"],  # all markers start blue
    opacity=0.75,
    height=600,
)
# Force rectangle-select mode (so dragging a box selects points, not zoom)
base_fig.update_layout(dragmode="select")


# ------------------------------------------------------------
# 3 · Dash app layout
# ------------------------------------------------------------
app = Dash(__name__)
app.layout = html.Div(
    [
        html.H2("Predicate evolution — single‐plot demo"),
        dcc.Graph(
            id="scatter-plot",
            figure=base_fig,
            config={"displayModeBar": False},  # hide extra modebar buttons
            style={"width": "40%", "height": "650px"},
        ),
        html.Div(
            [
                html.Button("Fit predicate", id="fit-button", disabled=True),
                html.Button("Reset selection", id="reset-button", n_clicks=0, style={"margin-left": "10px"}),
                html.Span("  ", id="info-text"),  # for showing “N points selected”
            ],
            style={"margin": "10px 0"},
        ),
        # Hidden store to keep track of the selected‐point indices
        dcc.Store(id="selected-indices", data=[]),
        # Hidden store to keep the final_pred vector once computed
        dcc.Store(id="final-pred", data=[]),
        # Hidden store for the grey‐box bounding box coordinates
        dcc.Store(id="bbox", data={}),
    ],
    style={"margin": "20px"},
)


# ------------------------------------------------------------
# 4 · Callbacks
# ------------------------------------------------------------
@app.callback(
    Output("fit-button", "disabled"),
    Output("info-text", "children"),
    Output("selected-indices", "data"),
    Output("bbox", "data"),
    Input("scatter-plot", "selectedData"),
    Input("reset-button", "n_clicks"),
)
def update_selection(selectedData, reset_clicks):
    """
    • If “Reset selection” was clicked last, clear everything.
    • Otherwise, if a new rectangle selection exists, extract those indices.
    • If no valid selection, disable the Fit button.
    """
    ctx = callback_context
    if not ctx.triggered:
        # Nothing triggered (initial load)
        return True, "", [], {}

    triggered_id = ctx.triggered[0]["prop_id"].split(".")[0]
    if triggered_id == "reset-button":
        # User clicked “Reset selection” → clear selection
        return True, "", [], {}

    # Otherwise, the only other trigger is a new rectangle selection
    if selectedData and "points" in selectedData and len(selectedData["points"]) > 0:
        indices = [pt["pointIndex"] for pt in selectedData["points"]]
        info = f"{len(indices)} points selected"

        x0, x1 = selectedData["range"]["x"]
        y0, y1 = selectedData["range"]["y"]
        rect = {"x0": x0, "x1": x1, "y0": y0, "y1": y1}
        return False, info, indices, rect

    # No valid selection → disable Fit predicate
    return True, "", [], {}

@app.callback(
    Output("final-pred", "data"),
    Input("fit-button", "n_clicks"),
    State("selected-indices", "data"),
)
def run_predicate(n_clicks, selected_indices):
    """
    When “Fit predicate” is clicked, we have a list of selected_indices.
    We build a boolean mask vector, run your `fit_predicate_final`, and
    return the final_pred array plus the bounding‐box of the selection.
    """
    if n_clicks is None or len(selected_indices) == 0:
        # Nothing to do if button never clicked or no selection
        return no_update

    mask = np.zeros(len(df), dtype=bool)
    mask[selected_indices] = True

    # Compute final_pred using your existing function
    final_pred = fit_predicate_final(coords, mask)


    # Convert numpy array to list for JSON storage
    return final_pred.tolist()

@app.callback(
    Output("scatter-plot", "figure"),
    Input("final-pred", "data"),
    Input("reset-button", "n_clicks"),
    State("selected-indices", "data"),
    State("bbox", "data"),
)
def update_figure(final_pred, reset_clicks, selected_indices, bbox):
    """
    • If the Reset button fired last → return base_fig (clears any reds).
    • Else if final_pred is empty → return base_fig.
    • Otherwise build the red/blue scatter + grey rectangle.
    """
    from dash import callback_context
    ctx = callback_context
    if not ctx.triggered:
        return base_fig

    triggered_id = ctx.triggered[0]["prop_id"].split(".")[0]
    if triggered_id == "reset-button":
        # Return the original blue scatter (erase any red)
        return base_fig

    if not isinstance(final_pred, (list, tuple, np.ndarray)) or len(final_pred) == 0:
        return base_fig

    # ===== existing “final_pred available” logic below =====
    final_pred_np = np.array(final_pred)

    colors = np.full(len(df), "#1f77b4")
    inside_pred = (final_pred_np > 0.5)
    colors[inside_pred] = "red"

    fig = px.scatter(
        df,
        x=x_axis,
        y=y_axis,
        color=colors,
        color_discrete_map="identity",
        opacity=0.75,
        height=600,
    )
    fig.update_traces(marker=dict(size=6, line=dict(width=0)))

    if bbox:
        fig.add_shape(
            type="rect",
            x0=bbox["x0"], y0=bbox["y0"],
            x1=bbox["x1"], y1=bbox["y1"],
            fillcolor="rgba(180,180,180,0.80)",
            line=dict(width=0),
            layer="below",
        )

    return fig



# ------------------------------------------------------------
# 5 · Run the Dash server
# ------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)
