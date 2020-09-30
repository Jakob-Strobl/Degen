import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";
import { createRequire } from "https://deno.land/std@0.69.0/node/module.ts";
import { ensureDirSync, copySync } from "https://deno.land/std@0.69.0/fs/mod.ts"

import * as Degen from "./lib.ts";
import { Util } from "./util.ts";
import { Pages } from "./pages.ts"
import { Temple } from "./temple.ts";

export let getProjectHints: Function;

/**
 * set project hints to a global variable wrapped in a closure via a get function 
 * Project hints are properties that are the same across all pages: 
 * @param source_path Project source path 
 * @param export_path Project export path
 * @param domain_url Project domain url 
 */
function setProjectHints(source_path: string, export_path: string, domain_url: string) : Function {
    const project_hints: Degen.ProjectHints = {
        source: new Degen.DegenPath(source_path),
        export: new Degen.DegenPath(export_path),
        domain_url
    }

    function getProjectHints() : Degen.ProjectHints {
        return project_hints;
    }

    return getProjectHints;
}

/**
 * Open project config file and changes working directory to the same directory as the project config file 
 * @param path path to file
 * @returns Project Config JS object 
 */
export async function openProjectConfig(path: Degen.DegenPath) {
    const config = await Util.getProjectConfig(path);
    console.log(`Changing working directory to project config ${path.dir}`);
    Deno.chdir(path.dir);

    getProjectHints = setProjectHints(config.project.source_path, config.project.export_path, config.project.domain_url);
    return config;
} 

/**
 * The heart and soul of Degen - this is the whole SSG pipeline
 * @param project_config_path Path to project config file 
 */
async function generate(project_config_path: Degen.DegenPath) {
    // I dont like that I need a pseudo require() to mimick node.js importing D: 
    // But im glad node modules are supported
    const require = createRequire(import.meta.url);
    const markit_mod = require('../dependencies/markdown-it.js');

    // Initialization - read in config file and instantiate required functionality 
    const config = await openProjectConfig(project_config_path);
    const markit = markit_mod({
        html: config.degen.enable_html_in_markdown,    // Enable HTML tags in source
    });

    // Find all the pages in the directories declared in statis.toml - settings.pages
    const page_entries = Util.getSetOfAllPageEntries([getProjectHints().source.full_path]);
    const page_paths = new Array<Degen.DegenPath>();
    page_entries.forEach((entry) => {
        page_paths.push(new Degen.DegenPath(entry));
    })

    // Prep page representation for render phase
    const page_render_queue = new Array<Pages.Page>();
    const compendium = new Pages.Compendium();

    // Read in all the pages
    console.log("Preparing Pages...");
    try {
        for await (const page of page_paths) {
            const page_text = await Util.readFile(page)
            const statis_page = Pages.parsePage(page_text, page);

            // If public add to the array of public pages
            if (statis_page.get('is_public')) {
                page_render_queue.push(statis_page);
                compendium.addPage(statis_page);
            }
        }
    } catch (e) {
        console.log(e);
    }

    // console.log(compendium.toString());

    // Copy Passthrough
    for (const src_dir in config.project.passthrough) {
        const dest_dir = config.project.passthrough[src_dir];
        console.log(`Copying '${src_dir}' to '${dest_dir}'`);
        ensureDirSync(dest_dir);
        copySync(src_dir, dest_dir, {overwrite: true});
    }

    // Render all public pages :D
    console.log("Rendering...")
    try {
        for (const page of page_render_queue) {
            const plated_markdown = Temple.renderString(page.markdown(), page, compendium);
            page.set('body', markit.render(plated_markdown));
            const html = await Temple.render(page, compendium);
            await Util.writePage(html, page, config.degen);
        }
    } catch (e) {
        console.log(e);
    }

    console.log(`Site Rendered to ${Deno.realPathSync(config.project.export_path)}`);
}

async function main() {
    try {
        if (Deno.args.length === 1) {
            let path;
            try {
                path = new Degen.DegenPath(Deno.args[0]);
            } catch (e: unknown) {
                throw new Degen.DegenError(
                    "D100",
                    "Project Config could not be found",
                    Path.resolve(Deno.cwd(), Deno.args[0])
                );
            }

            await generate(path);
        } else {
            console.log("Please provide path to project config file.");
        }
    } catch (e) {
        console.log(e);
    }
}

main();