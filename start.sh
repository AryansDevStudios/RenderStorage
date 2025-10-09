cd /opt/render/project/src/
pwd
ls

chmod +x start.sh
chmod +x filebrowser
chmod +x start.js

git config --global user.email "aryansdevstudios@gmail.com"
git config --global user.name "aryansdevstudios"

git init
git remote add origin https://github.com/AryansDevStudios/RenderStorage.git
git fetch
git checkout main
git pull origin main 
git branch -M main
git add . 
git commit -m "Initial commit" 
git push -u origin main


npm install express http-proxy-middleware node-pty body-parser helmet cors mime-types xterm

echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc