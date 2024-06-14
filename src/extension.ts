import * as vscode from "vscode";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "big-if-true" is now active!');

  const decorationType = vscode.window.createTextEditorDecorationType({
    fontWeight: "900",
    letterSpacing: "8px",
  });

  function lintDocument(editor: vscode.TextEditor) {
    console.log("Linting document:", editor.document.fileName); // Debug log
    const text = editor.document.getText();
    const ast = acorn.parse(text, {
      ecmaVersion: 2020,
      locations: true,
    }) as acorn.Node;

    const ranges: vscode.DecorationOptions[] = [];
    const variableValues: { [key: string]: any } = {};

    function analyzeNode(node: acorn.Node) {
      switch (node.type) {
        case "VariableDeclaration":
          (node as acorn.Node & { declarations: any[] }).declarations.forEach(
            (declaration: any) => {
              if (declaration.init && declaration.id.type === "Identifier") {
                variableValues[declaration.id.name] = evaluateExpression(
                  declaration.init
                );
              }
            }
          );
          break;
        case "IfStatement":
          const ifNode = node as acorn.Node & { test: any };
          if (evaluateExpression(ifNode.test) === true) {
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

    function evaluateExpression(node: acorn.Node): any {
      switch (node.type) {
        case "Literal":
          return (node as acorn.Node & { value: any }).value;
        case "Identifier":
          return variableValues[(node as acorn.Node & { name: string }).name];
        case "BinaryExpression":
          const binaryNode = node as acorn.Node & {
            left: any;
            right: any;
            operator: string;
          };
          const left = evaluateExpression(binaryNode.left);
          const right = evaluateExpression(binaryNode.right);
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
          const leftLogical = evaluateExpression(logicalNode.left);
          const rightLogical = evaluateExpression(logicalNode.right);
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

    // Analyze the AST starting from the root
    walk.simple(ast, {
      VariableDeclaration(node: acorn.Node) {
        analyzeNode(node);
      },
      IfStatement(node: acorn.Node) {
        analyzeNode(node);
      },
    });

    // Apply decorations to the editor
    editor.setDecorations(decorationType, ranges);
  }

  // Register the command for manual execution
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

  // Listen for document changes and apply linting
  vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document === event.document
    );
    if (editor) {
      lintDocument(editor);
    }
  });

  // Apply linting when the document is saved
  vscode.workspace.onDidSaveTextDocument((document) => {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document === document
    );
    if (editor) {
      lintDocument(editor);
    }
  });

  // Apply linting when the active editor changes
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      lintDocument(editor);
    }
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
