import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Set clean IEEE figure styling
plt.rcParams.update({
    'font.size': 10,
    'font.family': 'serif',
    'figure.autolayout': True
})

fig, ax = plt.subplots(figsize=(10, 6.2))
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis('off')

# Styling constants
BOX_STYLE = dict(boxstyle='square,pad=0.6', facecolor='#f8fafc', edgecolor='#0f172a', linewidth=1.4)
ACCENT_STYLE = dict(boxstyle='square,pad=0.6', facecolor='#eff6ff', edgecolor='#1e40af', linewidth=1.5)
VERIF_STYLE = dict(boxstyle='square,pad=0.6', facecolor='#f0fdf4', edgecolor='#166534', linewidth=1.5)
ARROW_PROPS = dict(arrowstyle='->', lw=1.3, color='#0f172a')

# 1. Input Box (Top)
ax.text(50, 93, 'Legacy Codebase Ingestion\n(ZIP Archive / Remote Git Repository)', 
        ha='center', va='center', bbox=BOX_STYLE, fontsize=10.5, fontweight='bold')

# Arrow Down
ax.annotate('', xy=(50, 84), xytext=(50, 89), arrowprops=ARROW_PROPS)

# 2. AST Static Parser Box
ax.text(50, 78, 'Tree-sitter AST Static Parser\n(Extracts Classes, Methods, Routes, Fields & 1-Indexed Spans)', 
        ha='center', va='center', bbox=BOX_STYLE, fontsize=10)

# Arrow Down
ax.annotate('', xy=(50, 69), xytext=(50, 74), arrowprops=ARROW_PROPS)

# 3. SSKG Knowledge Graph Box
ax.text(50, 63, 'Semantic Software Knowledge Graph (SSKG)\n(Multi-Relational Topology: CALLS, USES, IMPLEMENTS, EXTENDS)', 
        ha='center', va='center', bbox=ACCENT_STYLE, fontsize=10.5, fontweight='bold')

# Branching arrows from SSKG
# Branch Left -> Deterministic UML
ax.annotate('', xy=(25, 47), xytext=(38, 59), arrowprops=ARROW_PROPS)

# Branch Right -> Hybrid Retrieval & LLM
ax.annotate('', xy=(75, 47), xytext=(62, 59), arrowprops=ARROW_PROPS)

# 4. Left Branch: Deterministic UML Synthesizer
ax.text(25, 40, 'Deterministic UML Modeling\n(Class, Sequence, Component, Package,\nUse Case, Activity & Deployment SVGs)', 
        ha='center', va='center', bbox=BOX_STYLE, fontsize=9.5)

# 5. Right Branch: Hybrid Retrieval & LLM Reconstruction
ax.text(75, 40, 'Hybrid Evidence Retrieval & LLM\n(Dense ChromaDB + Sparse BM25 Search;\nArchitecture & Health Reconstruction)', 
        ha='center', va='center', bbox=BOX_STYLE, fontsize=9.5)

# Converging arrows to Verification
ax.annotate('', xy=(42, 26), xytext=(25, 33), arrowprops=ARROW_PROPS)
ax.annotate('', xy=(58, 26), xytext=(75, 33), arrowprops=ARROW_PROPS)

# 6. Retrieval-Augmented Verification (RAV) Box
ax.text(50, 21, 'Retrieval-Augmented Verification (RAV) Agent\n(Deterministic Confidence Scoring & Line-Level Evidence Grounding: C(s) = a*E + b*G + c*R)', 
        ha='center', va='center', bbox=VERIF_STYLE, fontsize=10, fontweight='bold')

# Arrow Down
ax.annotate('', xy=(50, 11), xytext=(50, 16), arrowprops=ARROW_PROPS)

# 7. Presentation Dashboard Box
ax.text(50, 6, 'Full-Stack Modernization Dashboard\n(FastAPI ASGI Microservice + React 18 Web UI + MongoDB)', 
        ha='center', va='center', bbox=BOX_STYLE, fontsize=10)

# Save high-resolution PNG & vector PDF
png_path = 'd:/final year project/Legacy software/fig1_system_architecture.png'
pdf_path = 'd:/final year project/Legacy software/fig1_system_architecture.pdf'

plt.savefig(png_path, dpi=300, bbox_inches='tight')
plt.savefig(pdf_path, bbox_inches='tight')
plt.close()

print(f"Generated successfully:\n - {png_path}\n - {pdf_path}")
