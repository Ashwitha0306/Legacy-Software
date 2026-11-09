import matplotlib.pyplot as plt
import numpy as np

# Set standard IEEE publication style
plt.rcParams.update({
    'font.size': 11,
    'font.family': 'serif',
    'axes.labelsize': 12,
    'axes.titlesize': 13,
    'xtick.labelsize': 10,
    'ytick.labelsize': 11,
    'figure.titlesize': 14,
    'figure.autolayout': True
})

# Data from the Table
metrics = [
    'Component\nExtraction\nPrecision',
    'Component\nRecovery\nRecall',
    'Overall\nExtraction\nF1-Score',
    'Generative\nHallucination\nRate',
    'Evidence\nCitation\nAccuracy',
    'Graph\nVerification\nAccuracy'
]

values = [96.80, 94.50, 95.64, 1.20, 93.80, 94.20]

# Colors: Distinctive styling for positive metrics vs hallucination rate
colors = ['#1e40af', '#1e40af', '#1e40af', '#dc2626', '#1e40af', '#1e40af']

fig, ax = plt.subplots(figsize=(8.5, 4.6))

x = np.arange(len(metrics))
width = 0.52

bars = ax.bar(x, values, width, color=colors, edgecolor='black', linewidth=1.1)

# Annotate value on top of each bar
for bar in bars:
    height = bar.get_height()
    ax.annotate(f'{height:.2f}%',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 4),  
                textcoords="offset points",
                ha='center', va='bottom', fontsize=10, fontweight='bold')

ax.set_ylabel('Fidelity & Accuracy Score (%)', fontweight='bold')
ax.set_title('Figure 3: Architectural Recovery and Verification Fidelity Metrics', fontweight='bold', pad=15)
ax.set_xticks(x)
ax.set_xticklabels(metrics, fontweight='bold')
ax.set_ylim(0, 115)
ax.grid(axis='y', linestyle='--', alpha=0.5)

# Highlight hallucination rate threshold
ax.axhline(0, color='black', linewidth=0.8)

# Save image in high resolution
output_png = 'd:/final year project/Legacy software/fig_architectural_recovery_fidelity.png'
output_pdf = 'd:/final year project/Legacy software/fig_architectural_recovery_fidelity.pdf'
plt.savefig(output_png, dpi=300)
plt.savefig(output_pdf)
plt.close()

print(f"Graph generated successfully:\n - {output_png}\n - {output_pdf}")
