# gm identify -verbose ./app/resources/jackie_chan.jpeg
gm convert \
  ./app/resources/jackie_chan.jpeg \
  -font ./app/resources/impaact.ttf \
  -pointsize 50 \
  -fill "#FFF" \
  -stroke "#000" \
  -strokewidth 1 \
  -draw "gravity center text 0,-125 \"What?!?!\"" \
  -draw "gravity center text 0,125 \"Oh no...\"" \
  output.png

echo "Complete!"