import * as vscode from "vscode";
import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as walk from "acorn-walk";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "big-if-true" is now active!');

  const decorationType = vscode.window.createTextEditorDecorationType({
    fontWeight: "900",
    letterSpacing: "8px",
  });

  function lintDocument(editor: vscode.TextEditor) {
    console.log("Linting document:", editor.document.fileName);
    const text = editor.document.getText();
    const ast = acornLoose.parse(text, {
      ecmaVersion: 2020,
      sourceType: "module",
      locations: true,
    }) as acorn.Node;

    const ranges: vscode.DecorationOptions[] = [];
    const variableValues: { [key: string]: any } = {};

    function analyzeNode(node: acorn.Node, scope: { [key: string]: any }) {
      switch (node.type) {
        case "VariableDeclaration":
          (node as acorn.Node & { declarations: any[] }).declarations.forEach(
            (declaration: any) => {
              if (declaration.init && declaration.id.type === "Identifier") {
                scope[declaration.id.name] = evaluateExpression(
                  declaration.init,
                  scope
                );
              }
            }
          );
          break;
        case "ExpressionStatement":
          if (
            (node as acorn.Node & { expression: any }).expression.type ===
            "AssignmentExpression"
          ) {
            const expression = (node as acorn.Node & { expression: any })
              .expression;
            if (expression.left.type === "Identifier") {
              scope[expression.left.name] = evaluateExpression(
                expression.right,
                scope
              );
            }
          }
          break;
        case "IfStatement":
          const ifNode = node as acorn.Node & { test: any };
          if (evaluateExpression(ifNode.test, scope) === true) {
            const startLine = ifNode.loc?.start.line
              ? ifNode.loc.start.line - 1
              : 0;
            const range = new vscode.Range(
              startLine,
              0,
              startLine,
              editor.document.lineAt(startLine).text.length
            );
            ranges.push({ range });
          }
          break;
      }
    }

    function evaluateExpression(
      node: acorn.Node,
      scope: { [key: string]: any }
    ): any {
      switch (node.type) {
        case "Literal":
          return (node as acorn.Node & { value: any }).value;
        case "Identifier":
          return scope[(node as acorn.Node & { name: string }).name];
        case "BinaryExpression":
          const binaryNode = node as acorn.Node & {
            left: any;
            right: any;
            operator: string;
          };
          const left = evaluateExpression(binaryNode.left, scope);
          const right = evaluateExpression(binaryNode.right, scope);
          switch (binaryNode.operator) {
            case "==":
              return left == right;
            case "===":
              return left === right;
            case "!=":
              return left != right;
            case "!==":
              return left !== right;
            case "<":
              return left < right;
            case "<=":
              return left <= right;
            case ">":
              return left > right;
            case ">=":
              return left >= right;
          }
          break;
        case "LogicalExpression":
          const logicalNode = node as acorn.Node & {
            left: any;
            right: any;
            operator: string;
          };
          const leftLogical = evaluateExpression(logicalNode.left, scope);
          const rightLogical = evaluateExpression(logicalNode.right, scope);
          switch (logicalNode.operator) {
            case "&&":
              return leftLogical && rightLogical;
            case "||":
              return leftLogical || rightLogical;
          }
          break;
      }
      return undefined;
    }

    walk.simple(ast, {
      VariableDeclaration(node: acorn.Node) {
        analyzeNode(node, variableValues);
      },
      ExpressionStatement(node: acorn.Node) {
        analyzeNode(node, variableValues);
      },
      IfStatement(node: acorn.Node) {
        analyzeNode(node, variableValues);
      },
    });

    editor.setDecorations(decorationType, ranges);
  }

  let disposable = vscode.commands.registerCommand(
    "big-if-true.lintAlwaysTrueIf",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        lintDocument(editor);
      } else {
        vscode.window.showErrorMessage("No active text editor found!");
      }
    }
  );

  context.subscriptions.push(disposable);

  vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document === event.document
    );
    if (editor) {
      lintDocument(editor);
    }
  });

  vscode.workspace.onDidSaveTextDocument((document) => {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document === document
    );
    if (editor) {
      lintDocument(editor);
    }
  });

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      lintDocument(editor);
    }
  });
}

export function deactivate() {}
