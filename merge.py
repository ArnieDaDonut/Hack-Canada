import re
import sys

with open('/Users/sameetmandewalker/Coding/Hack-Canada/jsx_output.js', 'r', encoding='utf-8') as f:
    jsx_content = f.read()

btn_hero = r'''<label className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-xl shadow-primary/25 flex items-center justify-center gap-2 transition-all cursor-pointer inline-flex">
                                Enhance My First Photo
                                <span className="material-symbols-outlined">arrow_forward</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
                            </label>'''

btn_nav = r'''<label className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer inline-flex">
                    Enhance My First Photo
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
                </label>'''

btn_cta = r'''<label className="bg-white text-primary px-10 py-5 rounded-xl text-lg font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer inline-flex whitespace-nowrap">
                        Enhance My First Photo
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
                    </label>'''

jsx_content = re.sub(
    r'<button className="bg-primary hover:bg-primary/90 text-white px-5[^>]*>.*?Enhance My First Photo.*?</button>',
    btn_nav, jsx_content, flags=re.DOTALL
)
jsx_content = re.sub(
    r'<button className="bg-primary hover:bg-primary/90 text-white px-8[^>]*>.*?Enhance My First Photo.*?</button>',
    btn_hero, jsx_content, flags=re.DOTALL
)
jsx_content = re.sub(
    r'<button className="bg-white text-primary px-10[^>]*>.*?Enhance My First Photo.*?</button>',
    btn_cta, jsx_content, flags=re.DOTALL
)

header = re.search(r'(<header.*?</header>)', jsx_content, re.DOTALL).group(1)
footer = re.search(r'(<footer.*?</footer>)', jsx_content, re.DOTALL).group(1)
sections = re.search(r'<main>(.*?)</main>', jsx_content, re.DOTALL).group(1)

with open('/Users/sameetmandewalker/Coding/Hack-Canada/RealEstate/src/App.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Safe Extraction of parts
config_modal = re.search(r'(<AnimatePresence>.*?</AnimatePresence>)', app_js, re.DOTALL).group(1)

workspace_start = app_js.find('{(imageState.publicId || isProcessing) && (')
workspace_end = app_js.find('</main>', workspace_start)
workspace_code = app_js[workspace_start:workspace_end].strip()

return_start = app_js.find('  return (')

new_return = f'''  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen relative">
      {{/* Configuration Modal */}}
      {config_modal}

      {header}

      <main>
        {{!imageState.publicId && !isProcessing && (
          <>
            {sections}
          </>
        )}}

        <div className="max-w-7xl mx-auto py-10 w-full relative z-10 px-6 lg:px-10">
            {workspace_code}
        </div>
      </main>

      {footer}
    </div>
  );
}}
'''

final_app_js = app_js[:return_start] + new_return + '\nexport default App;\n'

with open('/Users/sameetmandewalker/Coding/Hack-Canada/RealEstate/src/App.js', 'w', encoding='utf-8') as f:
    f.write(final_app_js)

print("Merged correctly this time!")
