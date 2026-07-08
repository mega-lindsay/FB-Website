import datetime

new_pages = [
    {"loc": "https://federalbenefitsexchange.com/about/\", "priority": "0.8", "changefreq": "monthly"},
    {"loc": "https://federalbenefitsexchange.com/resources/\", "priority": "0.8", "changefreq": "weekly"},
    {"loc": "https://federalbenefitsexchange.com/glossary/\", "priority": "0.8", "changefreq": "weekly"},
    {"loc": "https://federalbenefitsexchange.com/faq/\", "priority": "0.9", "changefreq": "weekly"},
]

with open('sitemap.xml', 'r') as f:
    lines = f.readlines()

today = datetime.date.today().isoformat()

# Filter out old versions of these pages if they exist
filtered_lines = []
skip_until_url_end = False
for line in lines:
    if '<loc>' in line:
        url = line.split('<loc>')[1].split('</loc>')[0]
        if any(p['loc'] == url for p in new_pages) or url == "https://federalbenefitsexchange.com/faq/\":
            skip_until_url_end = True
            continue
    if skip_until_url_end:
        if '</url>' in line:
            skip_until_url_end = False
        continue
    if '</urlset>' in line:
        continue
    filtered_lines.append(line)

# Add new pages
new_entries = []
for p in new_pages:
    entry = f"""  <url>
    <loc>{p['loc']}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{p['changefreq']}</changefreq>
    <priority>{p['priority']}</priority>
  </url>
"""
    new_entries.append(entry)

final_content = "".join(filtered_lines) + "".join(new_entries) + "</urlset>\n"

with open('sitemap.xml', 'w') as f:
    f.write(final_content)

print("sitemap.xml updated with new pages and latest mod dates.")
