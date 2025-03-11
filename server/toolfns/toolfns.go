package toolfns

import (
	"github.com/byte-sat/llum-tools/tools"
	"log"
	"os/exec"
)

// Note: Generated filename is significant. The init function for the generated file must run first.
//go:generate go run github.com/noonien/codoc/cmd/codoc@latest -out generated_toolfns.go -pkg toolfns .

var ToolGroups []*Group

func init() {
	ToolGroups = []*Group{
		NewGroup("System",
			executor.Shell,
			//Shell,
		),
	}
}

type Group struct {
	Name string      `json:"name"`
	Repo *tools.Repo `json:"-"`
}

func NewGroup(name string, fns ...any) *Group {
	repo, err := tools.New(nil, fns...)
	if err != nil {
		log.Fatal(err)
	}
	return &Group{
		Name: name,
		Repo: repo,
	}
}

type ContentTypeResponse struct {
	ContentType string `json:"contentType"`
	Content     string `json:"content"`
}

// Executes the given bash command and returns the output of the command.
// command: The bash command to execute.
func Shell(command string) string {
	cmd := exec.Command("bash", "-c", command)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return err.Error() + "\n" + string(out)
	}
	return string(out)
}
