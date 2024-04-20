package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"strings"
	"syscall"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/zakkor/server/llm"
	"github.com/zakkor/server/tools"
)

var (
	LLAMAPath   = flag.String("llamapath", "/Users/ed/src/llama.cpp", "Path to LLAMA")
	SandboxPath = flag.String("sandbox", "/Users/ed/src/lluminous/server/sandbox", "Sandbox directory")
)

func main() {
	flag.Parse()

	var activeLlama *llm.LlamaServer

	// Start HTTP server
	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"https://*", "http://*"},
	}))

	// FIXME: Use a ping to check if the server is up
	// router.Get("/models", func(w http.ResponseWriter, r *http.Request) {
	// 	data, err := json.Marshal(map[string]any{
	// 		"models": listLocalModels(),
	// 	})
	// 	if err != nil {
	// 		w.WriteHeader(http.StatusInternalServerError)
	// 		return
	// 	}

	// 	w.Write(data)
	// })

	// FIXME: Getting the active llama model should not set the active model in client.
	// router.Get("/model", func(w http.ResponseWriter, r *http.Request) {
	// 	if activeLlama == nil {

	// 		data, err := json.Marshal(map[string]any{
	// 			"model": "",
	// 		})
	// 		if err != nil {
	// 			w.WriteHeader(http.StatusInternalServerError)
	// 			return
	// 		}
	// 		w.Write(data)
	// 		return
	// 	}
	// 	data, err := json.Marshal(map[string]any{
	// 		"model": activeLlama.ModelName,
	// 	})
	// 	if err != nil {
	// 		w.WriteHeader(http.StatusInternalServerError)
	// 		return
	// 	}
	// 	w.Write(data)
	// })
	// router.Post("/model", func(w http.ResponseWriter, r *http.Request) {
	// 	var newModel map[string]any
	// 	if err := json.NewDecoder(r.Body).Decode(&newModel); err != nil {
	// 		w.WriteHeader(http.StatusBadRequest)
	// 		return
	// 	}

	// 	if activeLlama != nil {
	// 		activeLlama.Close()
	// 	}
	// 	activeLlama = llm.Serve(newModel["model"].(string), []string{"-c", "4096", "-ngl", "1", "-t", "8", "-tb", "12", "-b", "4096"})

	// })

	router.Post("/tokenize_count", func(w http.ResponseWriter, r *http.Request) {
		var content map[string]any
		if err := json.NewDecoder(r.Body).Decode(&content); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if activeLlama == nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		count := llm.TokenizeCount(activeLlama, content["content"].(string))

		fmt.Fprintf(w, "%d", count)
	})

	router.Get("/tool_schema", func(w http.ResponseWriter, r *http.Request) {
		schemas := []tools.Schema{}
		for _, tool := range tools.Tools {
			schemas = append(schemas, tool.Schema)
		}

		schemasJSON, err := json.Marshal(schemas)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Write(schemasJSON)
	})

	router.Post("/tool", func(w http.ResponseWriter, r *http.Request) {
		var toolcall struct {
			Name      string          `json:"name"`
			Arguments tools.Arguments `json:"arguments"`
		}
		if err := json.NewDecoder(r.Body).Decode(&toolcall); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		schema := tools.Tools[toolcall.Name].Schema

		// Validate arguments
		for name, property := range schema.Function.Parameters.Properties {
			arg, ok := toolcall.Arguments[name]
			if !ok {
				w.WriteHeader(http.StatusBadRequest)
				fmt.Fprintf(w, "error performing tool call: expected argument \"%s\", but it is missing",
					name)
				return
			}

			if reflect.TypeOf(arg).Name() != property.Type {
				w.WriteHeader(http.StatusBadRequest)
				fmt.Fprintf(w, "error performing tool call: expected argument \"%s\" to be of type %s, but it is of type %s",
					name, property.Type, reflect.TypeOf(arg).Name())
				return
			}
		}

		// Call the tool
		fn := tools.Tools[toolcall.Name].Fn
		result := fn(toolcall.Arguments, *SandboxPath)

		// Return the result
		w.Write([]byte(result))
	})

	httpServer := &http.Server{Addr: ":8081", Handler: router}
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()

	// Signal handling
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	<-c // Block until a signal is received.

	// Graceful shutdown
	if err := httpServer.Shutdown(context.Background()); err != nil {
		panic(err)
	}
}

func listLocalModels() []string {
	// Open models directory and get a list of file names inside it
	dir, err := os.Open(filepath.Join(*LLAMAPath, "models"))
	if err != nil {
		panic(err)
	}
	defer dir.Close()

	files, err := dir.Readdirnames(0)
	if err != nil {
		panic(err)
	}

	// Get only files ending in .gguf
	models := []string{}
	for _, file := range files {
		if !strings.HasPrefix(file, "ggml-vocab") && filepath.Ext(file) == ".gguf" {
			models = append(models, file)
		}
	}

	return models
}
