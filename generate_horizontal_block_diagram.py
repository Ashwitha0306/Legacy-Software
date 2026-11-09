import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Set clean IEEE Times-like serif font
plt.rcParams.update({
    'font.size': 11,
    'font.family': 'serif',
    'figure.autolayout': True
})

# Create wide horizontal canvas matching the uploaded reference image
fig, ax = plt.subplots(figsize=(16, 4.5))
ax.set_xlim(0, 100)
ax.set_ylim(0, 30)
ax.axis('off')

# Helper to draw a standard B&W box
def draw_box(x, y, w, h, text, fontsize=9.5):
    rect = patches.Rectangle((x, y), w, h, facecolor='white', edgecolor='black', linewidth=1.1, zorder=3)
    ax.add_patch(rect)
    ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fontsize, color='black', zorder=4)
    return x, y, w, h

# Helper to draw hollow block arrow pointing right
def draw_hollow_arrow_right(x_start, x_end, y_center, stem_h=1.0, head_w=1.0, head_h=2.0):
    poly = [
        (x_start, y_center + stem_h / 2),
        (x_end - head_w, y_center + stem_h / 2),
        (x_end - head_w, y_center + head_h / 2),
        (x_end, y_center),
        (x_end - head_w, y_center - head_h / 2),
        (x_end - head_w, y_center - stem_h / 2),
        (x_start, y_center - stem_h / 2)
    ]
    arrow = patches.Polygon(poly, closed=True, facecolor='white', edgecolor='black', linewidth=1.0, zorder=2)
    ax.add_patch(arrow)

# Helper to draw line connections with an arrow head
def draw_routed_arrow(points, head_dir='right'):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    ax.plot(xs, ys, color='black', linewidth=1.1, zorder=2)
    
    end_x, end_y = points[-1]
    if head_dir == 'right':
        hw = 0.8
        hh = 1.0
        poly = [(end_x - hw, end_y + hh), (end_x, end_y), (end_x - hw, end_y - hh)]
        head = patches.Polygon(poly, closed=True, facecolor='black', edgecolor='black', zorder=3)
        ax.add_patch(head)

# ----------------- HORIZONTAL PIPELINE COORDINATES -----------------
y_main = 12.0
box_h = 6.0

# 1. Input Box: Legacy Codebase
b1 = draw_box(1.5, y_main, 7.5, box_h, "Legacy\nCodebase")
draw_hollow_arrow_right(9.0, 11.2, y_main + box_h / 2)

# 2. Sequential Box: Preprocessing
b2 = draw_box(11.2, y_main, 8.5, box_h, "Repository\nPreprocessing")
draw_hollow_arrow_right(19.7, 21.9, y_main + box_h / 2)

# 3. Split Box: AST Parsing
draw_box(21.9, y_main, 13.0, box_h, "")
ax.text(21.9 + 6.5, y_main + 4.4, "AST Source Parsing", ha='center', va='center', fontsize=10, zorder=4)
# Horizontal divider inside
ax.plot([21.9, 21.9 + 13.0], [y_main + 2.8, y_main + 2.8], color='black', linewidth=1.0, zorder=4)
# Vertical divider inside bottom
ax.plot([21.9 + 6.5, 21.9 + 6.5], [y_main, y_main + 2.8], color='black', linewidth=1.0, zorder=4)
ax.text(21.9 + 3.25, y_main + 1.4, "Tree-sitter\nGrammars", ha='center', va='center', fontsize=8.5, zorder=4)
ax.text(21.9 + 9.75, y_main + 1.4, "Structural\nEntities", ha='center', va='center', fontsize=8.5, zorder=4)

draw_hollow_arrow_right(34.9, 37.1, y_main + box_h / 2)

# 4. Sequential Box: Knowledge Graph
b4 = draw_box(37.1, y_main, 8.5, box_h, "Knowledge Graph\n(SSKG)")
draw_hollow_arrow_right(45.6, 47.8, y_main + box_h / 2)

# 5. Sequential Box: Hybrid Retrieval
b5 = draw_box(47.8, y_main, 8.0, box_h, "Hybrid\nRetrieval")
draw_hollow_arrow_right(55.8, 58.0, y_main + box_h / 2)

# 6. Branch Point Box: Architectural Reconstruction
b6 = draw_box(58.0, y_main, 8.5, box_h, "Architectural\nReconstruction")

# Fork branches from b6:
mid_y = y_main + box_h / 2 # 15.0
fork_x = 58.0 + 8.5 # 66.5

# Upper Branch Y
y_up = 20.0
# Lower Branch Y
y_down = 4.0

# Draw split lines to Upper and Lower
draw_routed_arrow([(fork_x, mid_y), (68.0, mid_y), (68.0, y_up + box_h / 2), (70.0, y_up + box_h / 2)], 'right')
draw_routed_arrow([(fork_x, mid_y), (68.0, mid_y), (68.0, y_down + box_h / 2), (70.0, y_down + box_h / 2)], 'right')

# Upper Branch: Diagram Generation Agent -> UML Diagrams (SVG)
draw_box(70.0, y_up, 6.5, box_h, "Diagram\nAgent", fontsize=9.5)
draw_hollow_arrow_right(76.5, 78.5, y_up + box_h / 2, stem_h=0.8, head_w=0.8, head_h=1.6)
draw_box(78.5, y_up, 6.5, box_h, "UML\nDiagrams\n(SVG)", fontsize=9.0)

# Lower Branch: Verification Agent (RAV) -> Evidence Grounding
draw_box(70.0, y_down, 6.5, box_h, "Verification\nAgent (RAV)", fontsize=9.0)
draw_hollow_arrow_right(76.5, 78.5, y_down + box_h / 2, stem_h=0.8, head_w=0.8, head_h=1.6)
draw_box(78.5, y_down, 6.5, box_h, "Evidence\nGrounding\n(Line Spans)", fontsize=8.8)

# Merge routing lines into Confidence Estimation Box
merge_in_x = 88.0
draw_routed_arrow([(78.5 + 6.5, y_up + box_h / 2), (86.5, y_up + box_h / 2), (86.5, mid_y), (merge_in_x, mid_y)], 'right')
draw_routed_arrow([(78.5 + 6.5, y_down + box_h / 2), (86.5, y_down + box_h / 2), (86.5, mid_y), (merge_in_x, mid_y)], 'right')

# 7. Merge Box: Confidence Estimation (Exact term from Section V.G)
draw_box(88.0, y_main, 5.2, box_h, "Confidence\nEstimation\nC(s)", fontsize=8.8)
draw_hollow_arrow_right(93.2, 94.6, mid_y, stem_h=0.8, head_w=0.7, head_h=1.6)

# 8. Final Output Box: Verified Architecture Insights
draw_box(94.6, y_main, 5.0, box_h, "Verified\nArchitecture\nInsights", fontsize=8.5)

# Save high-resolution PNG and PDF
png_path = 'd:/final year project/Legacy software/fig1_simple_horizontal_block_diagram.png'
pdf_path = 'd:/final year project/Legacy software/fig1_simple_horizontal_block_diagram.pdf'

plt.savefig(png_path, dpi=300, bbox_inches='tight', pad_inches=0.08)
plt.savefig(pdf_path, bbox_inches='tight', pad_inches=0.08)
plt.close()

print(f"Generated successfully with exact project terms:\n - {png_path}\n - {pdf_path}")
