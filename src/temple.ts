import * as Degen from "./lib.ts"; 
import { Util } from "./util.ts";
import { Pages } from "./pages.ts";

// Template Errors
export class TemplateError extends Degen.DegenError {
    constructor(error_code: string, msg: string, page: string, template: string) {
        super(error_code, msg, `${page} via ${template}`);
        this.name = "TemplateError";
    }
}

export class TemplateVariableUndefined extends TemplateError {
    constructor(template_variable: string, page: string, template: string) {
        super("T111", `Template Variable '${template_variable}', binds to an undefined property`, page, template);
    }
}

export interface TempleConfig {
    template_variable_decleration: RegExp;
    template_expression_decleration: RegExp;
    expression: RegExp;
}

// Temple - Template Engine
export module Temple {
    const regexs: TempleConfig = {
        template_variable_decleration: /!{(?!\{)\s*(\w+)(\..+?)?\s*}/g,
        template_expression_decleration: /\!{{((\r|\n|.)+?)}}/g,
        expression: /^(?<collection>\w+)([^.]*)?\.(?<func>((\n|\r|.)*))/,
    }

    async function readInTemplate(file_path: string) : Promise<string>  {
        return await Util.readFile(file_path);
    }

    export function renderString(template: string, page: Pages.Page, compendium: Pages.Compendium)  {
        function render(page: Pages.Page) {
            function parseTemplateVariables(match: any, variable: string, calls?: string) : string {
                variable = variable.trim();
                if (variable in page.getData()) {
                    const var_data = page.get(variable);
                    if (calls) {
                        const renderVariableExpression = new Function(
                            "variable",
                            `return variable${calls};`
                        );
                        return renderVariableExpression(var_data);
                    } else {
                        return var_data;
                    }
                } else { 
                    throw new TemplateVariableUndefined(variable, page.get('page_path'), page.get('template'));
                }
            }

            function parseTemplateExpressions(match: any, expr1: string) {
                let expr = expr1.trim();

                // Parse the expression into groups
                const expr_regex = regexs.expression;
                const m = expr.match(expr_regex);
                if (!m || !m.groups) {
                    console.log("Regex Collection not found");
                    return match;
                }

                // Create dynamic function to execute
                const collection = m.groups.collection;
                const funcs = m.groups.func; 
                const renderExpression = new Function(
                    "compendium",
                    "collection",
                    "current_page", 
                    `return compendium.get(collection).${funcs};`
                );
                
                // Call dynamic function to render
                const out : Pages.PageCollection = renderExpression(compendium, collection, page);
                return out;
            }

            let output = template;

            // Parse template variables 
            output = output.replace(regexs.template_variable_decleration, parseTemplateVariables);
            // Parse template expressions
            output = output.replace(regexs.template_expression_decleration, parseTemplateExpressions);

            return output;
        }

        return render(page);
    }

    export async function render(page_data: Pages.Page, compendium: Pages.Compendium) {
        const template = await readInTemplate(page_data.get('template')); 
        return renderString(template, page_data, compendium);
    }
}