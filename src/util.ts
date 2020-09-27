import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";
import { parse as parseToml } from "https://deno.land/std@0.69.0/encoding/toml.ts"; 
import { ensureDirSync } from "https://deno.land/std@0.69.0/fs/mod.ts"

import * as Degen from "./lib.ts";
import { Pages } from "./pages.ts";


export module Util {    
    let config: Degen.ProjectConfig | null = null;

    export async function readFile(path: Degen.DegenPath) : Promise<string> {
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(await Deno.readFile(path.full_path));
    }

    export async function writePage(utf8: string, page: Pages.Page, degen_settings: Degen.DegenSettings) {
        const export_path = <Degen.DegenPath> page.get('export_path');
        ensureDirSync(export_path.dir);
        if (degen_settings.log_write_rendered_html) {
            console.log(`writing file to: ${export_path.file} via ${export_path.dir}`);
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(utf8);
        await Deno.writeFile(export_path.full_path, data);
    }

    export function getSetOfAllPageEntries(directory_paths: Array<string>) {
        let page_entries = new Set<string>();
        directory_paths = directory_paths.map((dir) => Deno.realPathSync(dir));
    
        // Find all child directories of the source paths
        for (const directory of directory_paths) {
            const entries = [...Deno.readDirSync(directory)]; // decompose iterator into an array 
    
            // Seperate directories and pages
            const dir_entries = entries.filter((entry: Deno.DirEntry) => entry.isDirectory);
            const dir_paths = dir_entries.map((dir: Deno.DirEntry) => Deno.realPathSync(`${directory}/${dir.name}`));
            
            const file_entries = entries.filter((entry: Deno.DirEntry) => entry.isFile && entry.name.match(/.md/i));
            const file_paths = file_entries.map((page: Deno.DirEntry) => Deno.realPathSync(`${directory}/${page.name}`));
    
            // Recurse 
            if (dir_entries.length > 0) {
                const child_paths = getSetOfAllPageEntries(dir_paths);
                for (const path of child_paths) {
                    page_entries.add(path);
                }
            }
    
            // Add current directories pages - Union the sets
            for (const path of file_paths) {
                page_entries.add(path);
            }
        }
    
        return page_entries;
    }

    export async function openProjectConfig(path: Degen.DegenPath) {
        const config = await getProjectConfig(path);
        console.log(`Changing working directory to project config ${path.dir}`);
        Deno.chdir(path.dir);

        return config;
    } 

    export async function getProjectConfig(path?: Degen.DegenPath) : Promise<Degen.ProjectConfig> {
        if (!config) {
            if (!path) {
                throw new Degen.DegenError(
                    "U100",
                    "Project config does not exist and no path was given",
                    path);
            } else {
                config = <Degen.ProjectConfig> <unknown> parseToml(await Util.readFile(path));
            }
        }
            
        return config;
    }

    export function getProjectConfigSync() {
        if (!config) {
            throw new Degen.DegenError(
                "U101",
                "Project config does not exist");
        }

        return config;
    }
}