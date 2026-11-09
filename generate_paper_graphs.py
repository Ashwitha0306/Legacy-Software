import matplotlib.pyplot as plt
import numpy as np

# Set standard IEEE publication style
plt.rcParams.update({
    'font.size': 12,
    'font.family': 'serif',
    'axes.labelsize': 13,
    'axes.titlesize': 14,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'legend.fontsize': 11,
    'figure.titlesize': 15,
    'figure.autolayout': True
})

# ==========================================
# GRAPH 1: Comparative Performance vs Baselines
# ==========================================
metrics = ['Precision', 'Recall', 'F1-Score', 'Citation Acc.', 'Hallucination']
zero_shot = [68.4, 74.2, 71.1, 48.2, 31.8]
naive_rag = [79.5, 81.0, 80.2, 63.8, 18.4]
proposed  = [96.8, 94.5, 95.6, 93.8, 1.2]

x = np.arange(len(metrics))
width = 0.25

fig, ax = plt.subplots(figsize=(8.5, 4.8))

rects1 = ax.bar(x - width, zero_shot, width, label='Zero-Shot LLM', color='#94a3b8', edgecolor='black', hatch='//')
rects2 = ax.bar(x, naive_rag, width, label='Standard Naive RAG', color='#60a5fa', edgecolor='black', hatch='\\\\')
rects3 = ax.bar(x + width, proposed, width, label='Proposed Framework (LegacyIntel)', color='#1e3a8a', edgecolor='black')

ax.set_ylabel('Percentage (%)', fontweight='bold')
ax.set_title('Figure 1: Comparative Performance Evaluation Against Baseline Models', fontweight='bold', pad=15)
ax.set_xticks(x)
ax.set_xticklabels(metrics, fontweight='bold')
ax.set_ylim(0, 115)
ax.grid(axis='y', linestyle='--', alpha=0.5)
ax.legend(frameon=True, loc='upper right')

# Value labels on top of bars
def autolabel(rects):
    for rect in rects:
        height = rect.get_height()
        ax.annotate(f'{height:.1f}%',
                    xy=(rect.get_x() + rect.get_width() / 2, height),
                    xytext=(0, 3),  
                    textcoords="offset points",
                    ha='center', va='bottom', fontsize=9.5, fontweight='bold')

autolabel(rects1)
autolabel(rects2)
autolabel(rects3)

plt.savefig('d:/final year project/Legacy software/fig1_comparative_performance.png', dpi=300)
plt.savefig('d:/final year project/Legacy software/fig1_comparative_performance.pdf')
plt.close()
print("Saved fig1_comparative_performance.png and .pdf")

# ==========================================
# GRAPH 2: Ablation Study Progression
# ==========================================
configurations = [
    'Plain LLM\n(Zero-Shot)',
    'LLM +\nDense RAG',
    'LLM +\nSSKG Graph',
    'Proposed Full\nPipeline (RAV)'
]
citation_acc = [48.2, 64.1, 85.2, 93.8]
hallucination_rate = [31.8, 17.5, 4.8, 1.2]

fig, ax = plt.subplots(figsize=(8.0, 4.6))

# Plot lines with markers
line1 = ax.plot(configurations, citation_acc, marker='o', markersize=9, linewidth=2.6, 
                color='#1e40af', label='Evidence Citation Accuracy (Higher is Better)')
line2 = ax.plot(configurations, hallucination_rate, marker='s', markersize=9, linewidth=2.6, 
                color='#dc2626', linestyle='--', label='Hallucination Rate (Lower is Better)')

ax.set_ylabel('Score (%)', fontweight='bold')
ax.set_title('Figure 2: Component Ablation Progression Across System Tiers', fontweight='bold', pad=15)
ax.set_ylim(-2, 108)
ax.grid(True, linestyle=':', alpha=0.6)
ax.legend(frameon=True, loc='center right')

# Add data callouts
for i, txt in enumerate(citation_acc):
    ax.annotate(f'{txt:.1f}%', (configurations[i], citation_acc[i] + 3.2), ha='center', fontweight='bold', color='#1e40af')

for i, txt in enumerate(hallucination_rate):
    ax.annotate(f'{txt:.1f}%', (configurations[i], hallucination_rate[i] + 3.2), ha='center', fontweight='bold', color='#dc2626')

plt.savefig('d:/final year project/Legacy software/fig2_ablation_progression.png', dpi=300)
plt.savefig('d:/final year project/Legacy software/fig2_ablation_progression.pdf')
plt.close()
print("Saved fig2_ablation_progression.png and .pdf")
