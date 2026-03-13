import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [NgClass],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss'
})
export class ComingSoonComponent {
  @Input() title: string = 'Đang phát triển';
  @Input() description: string = 'Tính năng này đang được phát triển.';
  @Input() icon: string = 'pi-cog';
}
