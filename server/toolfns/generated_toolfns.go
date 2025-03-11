// generated @ 2025-03-11T21:22:16+02:00 by gendoc
package toolfns

import "github.com/noonien/codoc"

func init() {
	codoc.Register(codoc.Package{
		ID:   "github.com/zakkor/server/toolfns",
		Name: "toolfns",
		Doc:  "generated @ 2025-03-11T21:10:41+02:00 by gendoc",
		Functions: map[string]codoc.Function{
			"NewGroup": {
				Name: "NewGroup",
				Args: []string{
					"name",
					"fns",
				},
			},
			"NewShellExecutor": {
				Name: "NewShellExecutor",
				Doc:  "NewShellExecutor creates a new shell executor with default state",
			},
			"Shell": {
				Name: "Shell",
				Doc:  "Executes the given bash command and returns the output of the command.\ncommand: The bash command to execute.",
				Args: []string{
					"command",
				},
			},
			"formatOutput": {
				Name: "formatOutput",
				Doc:  "Format command output including stderr and errors",
				Args: []string{
					"stdout",
					"stderr",
					"err",
				},
			},
			"handleTimeout": {
				Name: "handleTimeout",
				Doc:  "Handle command timeout with helpful message",
				Args: []string{
					"command",
					"stdout",
					"stderr",
				},
			},
			"init": {
				Name: "init",
			},
		},
		Structs: map[string]codoc.Struct{
			"ContentTypeResponse": {
				Name: "ContentTypeResponse",
			},
			"Group": {
				Name: "Group",
			},
			"ShellExecutor": {
				Name: "ShellExecutor",
				Doc:  "ShellExecutor maintains shell state between commands",
				Fields: map[string]codoc.Field{
					"dir": {
						Doc: "Current working directory",
					},
					"env": {
						Doc: "Environment variables",
					},
				},
				Methods: map[string]codoc.Function{
					"Shell": {
						Name: "Shell",
						Doc:  "Executes the given bash command and returns the output of the command.\ncommand: The bash command to execute.",
						Args: []string{
							"command",
						},
					},
					"updateState": {
						Name: "updateState",
						Doc:  "updateState refreshes environment and working directory after command execution",
					},
				},
			},
		},
	})
}
