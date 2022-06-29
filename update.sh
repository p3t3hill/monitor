cd ~
curl -s https://api.github.com/repos/p3t3hill/monitor/releases/latest   | grep tarball_url  | cut -d '"' -f 4   | wget -O monitor.tar.gz -qi -
tar -xvf monitor.tar.gz
cd p3t3hill-monitor*
cp -r * ~/monitor
cd ~
rm -rf p3t3hill-monitor*
rm monitor.tar.gz
cd monitor
npm install
cd ~
sudo systemctl stop  monitor.service
sudo systemctl start  monitor.service

