import re

with open('/Users/sameetmandewalker/Coding/Hack-Canada/stitch/code.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract inner body content
body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
if body_match:
    body = body_match.group(1)
else:
    body = html

# Convert class to className
body = body.replace('class="', 'className="')

# Convert <!-- --> to {/* */}
body = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', body)

# Close self-closing tags
self_closing = ['img', 'input', 'br', 'hr', 'meta', 'link']
for tag in self_closing:
    body = re.sub(rf'(<{tag}[^>]*)(?<!/)>', r'\1 />', body)

# Write to file
with open('/Users/sameetmandewalker/Coding/Hack-Canada/jsx_output.js', 'w', encoding='utf-8') as f:
    f.write(body)
