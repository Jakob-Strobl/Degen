import { createRequire } from "https://deno.land/std@0.69.0/node/module.ts";
import { ensureDirSync, copySync } from "https://deno.land/std@0.69.0/fs/mod.ts"
import { Util } from "./util.ts";
import { Pages } from "./pages.ts"
import { Header } from "./header.ts";
import { Temple } from "./temple.ts";

async function main () {
    // Initialization - read in config file and instantiate required functionality 
    const config_filepath = "degen.toml";
    const config = await Util.getStatisTomlConfig(config_filepath);

    // I dont like that I need a pseudo require() to mimick node.js importing D: 
    // But im glad node modules are supported
    const require = createRequire(import.meta.url);
    const markit = require('./markdown-it.js')({
        html: true,    // Enable HTML tags in source // TODO make configurable in statis.toml
    });

    console.log(config);

    // Find all the pages in the directories declared in statis.toml - settings.pages
    const source_directory = Deno.realPathSync(config.settings.pages.source_directory);
    console.log(source_directory);
    const page_entries = Util.getSetOfAllPageEntries([source_directory]);
    const page_render_queue = new Array<Pages.Page>();
    const compendium = new Pages.Compendium();

    // Read in all the pages
    try {
        for await (const page of page_entries) {
            const page_text = await Util.readFile(page)
            const statis_page = Header.parseStatisPage(page_text, page, config);

            // If public add to the array of public pages
            if (statis_page.get('is_public')) {
                page_render_queue.push(statis_page);
                compendium.addPage(statis_page);
            }
        }
    } catch (e) {
        console.log(e);
    }

    console.log(compendium.toString());
    console.log(compendium.get('posts'));
    console.log(compendium.get('home'));

    // Copy Passthrough
    const passthroughs = config.settings.passthrough;
    for (const src_dir in passthroughs) {
        const dest_dir = passthroughs[src_dir];
        console.log(`Passing ${src_dir} to ${dest_dir}`);
        ensureDirSync(dest_dir);
        copySync(src_dir, dest_dir, {overwrite: true});
    }

    // Render all public pages :D
    try {
        for (const page of page_render_queue) {
            const plated_markdown = Temple.renderString(page.markdown(), page, compendium);
            const rendered_markdown = markit.render(plated_markdown);
            page.setBody(rendered_markdown);
            const html = await Temple.render(page, compendium);
            await Util.writePage(html, page);
            // break;
        }
    } catch (e) {
        console.log(e);
    }
}

main();