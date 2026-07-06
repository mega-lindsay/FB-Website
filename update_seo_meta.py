import os

def update_file(filepath, city, state):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # 1. Update Title and Meta Description for Geo-Optimization if not already present
    geo_suffix = f" | Serving Federal Employees in {city}, {state}"
    if geo_suffix not in content:
        # Update <title>
        content = content.replace(' | Federal Benefits Exchange</title>', f' | Federal Benefits Exchange{geo_suffix}</title>')
        # Update meta description to include location
        geo_desc = f" Serving the federal community in {city}, {state}."
        content = content.replace('">', f'{geo_desc}">', 1) # Simple attempt to append to first meta desc
    
    # 2. Add LocalBusiness JSON-LD if not present
    local_biz_schema = f"""
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Federal Benefits Exchange",
    "image": "https://federalbenefitsexchange.com/logo.png",
    "@id": "https://federalbenefitsexchange.com",
    "url": "https://federalbenefitsexchange.com",
    "telephone": "(706) 407-2744",
    "address": {{
      "@type": "PostalAddress",
      "streetAddress": "332 Edgefield Rd",
      "addressLocality": "North Augusta",
      "addressRegion": "SC",
      "postalCode": "29841",
      "addressCountry": "US"
    }},
    "geo": {{
      "@type": "GeoCoordinates",
      "latitude": 33.5019,
      "longitude": -81.9651
    }},
    "openingHoursSpecification": {{
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "opens": "09:00",
      "closes": "17:00"
    }},
    "sameAs": [
      "https://www.facebook.com/federalbenefitsexchange"
    ]
  }}
  </script>
"""
    if 'LocalBusiness' not in content:
        content = content.replace('</head>', local_biz_schema + '\n</head>')

    with open(filepath, 'w') as f:
        f.write(content)

# Target main landing pages for geo-optimization
target_files = ['index.html', 'postal.html', 'usps.html', 'about.html', 'faq.html', 'resources.html', 'glossary.html']
for filename in target_files:
    if os.path.exists(filename):
        update_file(filename, "Augusta", "GA")
        print(f"Geo-optimized {filename}")

