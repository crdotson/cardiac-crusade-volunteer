#!/bin/bash

# Configuration Variables
SESSION_NAME="cardiac-dev"
K8S_SVC="svc/cardiac-crusade-db" # Adjust to your database service name
K8S_NAMESPACE="default" # Adjust to your namespace
DB_USER="postgres"
DB_PASS="postgres"
DB_NAME="cardiac_crusade"

# Check if tmux session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
  echo "Creating new tmux session: $SESSION_NAME..."

  # Create a new session in detached mode and name the first window "Database"
  tmux new-session -d -s $SESSION_NAME -n "Database"
  
  # Window 1: Database Port Forward
  tmux send-keys -t $SESSION_NAME:0 "echo 'Starting Kubernetes Port Forward...'" C-m
  tmux send-keys -t $SESSION_NAME:0 "kubectl port-forward $K8S_SVC 5432:5432 -n $K8S_NAMESPACE" C-m

  # Window 2: Backend Server
  tmux new-window -t $SESSION_NAME -n "Server"
  tmux send-keys -t $SESSION_NAME:1 "cd server" C-m
  tmux send-keys -t $SESSION_NAME:1 "export POSTGRES_HOST=localhost" C-m
  tmux send-keys -t $SESSION_NAME:1 "export POSTGRES_USER=$DB_USER" C-m
  tmux send-keys -t $SESSION_NAME:1 "export POSTGRES_PASSWORD=$DB_PASS" C-m
  tmux send-keys -t $SESSION_NAME:1 "export POSTGRES_DB=$DB_NAME" C-m
  tmux send-keys -t $SESSION_NAME:1 "export PORT=32973" C-m
  tmux send-keys -t $SESSION_NAME:1 "echo 'Waiting for DB port forward...'; sleep 3" C-m
  tmux send-keys -t $SESSION_NAME:1 "npm start" C-m

  # Window 3: Frontend Client
  tmux new-window -t $SESSION_NAME -n "Client"
  tmux send-keys -t $SESSION_NAME:2 "cd client" C-m
  tmux send-keys -t $SESSION_NAME:2 "npm run dev" C-m

  # Select the first window so they see the DB connection on attach
  tmux select-window -t $SESSION_NAME:0
else
  echo "Tmux session '$SESSION_NAME' already exists. Attaching..."
fi

# Attach to the session
tmux attach-session -t $SESSION_NAME
