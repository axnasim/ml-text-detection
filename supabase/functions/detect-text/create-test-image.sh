#!/bin/bash
convert -size 400x100 xc:white -font DejaVu-Sans -pointsize 32 \
        -draw "text 50,50 'Hello OCR Test'" \
        test-images/hello.png
